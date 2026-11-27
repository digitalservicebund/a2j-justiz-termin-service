import { log } from "../logging.ts";
import { connectRabbitMq } from "../rabbitmq.ts";
import { requireSecret } from "../secrets.ts";
import {
  createErvVersandClient,
  type ErvVersandClient,
  type ErvVersandReply,
} from "./erv-versand-client.ts";

type Connection = Awaited<ReturnType<typeof connectRabbitMq>>;

type State = {
  onReply?: (reply: ErvVersandReply) => Promise<void>;
  client?: Promise<ErvVersandClient>;
  connection?: Connection;
  retry?: ReturnType<typeof setTimeout>;
  attempts: number;
};

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 60_000;

// One connection to the Basisdienst: ERV Versand per process, for sending and for the replies. It
// lives on globalThis, so the development server's module reloads do not open a second one.
const STATE_KEY = Symbol.for("jts.ervVersand");
const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: State };
const state = (): State => (globalState[STATE_KEY] ??= { attempts: 0 });

// Connects to the Basisdienst and consumes its replies with `onReply`, now and after every lost
// connection. Called once when the server starts. If the broker cannot be reached, it tries again
// later, waiting longer each time.
export function startErvVersand(onReply: (reply: ErvVersandReply) => Promise<void>): void {
  const current = state();
  if (current.onReply) return;
  current.onReply = onReply;
  connected().catch(() => {
    // Logged and retried in connected().
  });
}

// The client of this process, once it is connected. Rejects if the Basisdienst cannot be reached.
export function ervVersandClient(): Promise<ErvVersandClient> {
  return connected();
}

// Closes the connection and forgets the reply handler, so nothing reconnects.
export async function stopErvVersand(): Promise<void> {
  const current = state();
  clearTimeout(current.retry);
  const { connection } = current;
  delete globalState[STATE_KEY];
  await connection?.close().catch(() => {});
}

function connected(): Promise<ErvVersandClient> {
  const current = state();
  current.client ??= connect(current).catch((error: unknown) => {
    current.client = undefined;
    log.error({ err: error }, "could not connect to the ERV Versand");
    scheduleReconnect(current);
    throw error;
  });
  return current.client;
}

async function connect(current: State): Promise<ErvVersandClient> {
  const { onReply } = current;
  if (!onReply) throw new Error("The ERV Versand was not started.");

  const connection = await connectRabbitMq();
  current.connection = connection;
  connection.on("error", (error: unknown) =>
    log.error({ err: error }, "ERV Versand connection failed"),
  );
  connection.on("close", () => {
    if (state() !== current) return;
    log.warn("ERV Versand connection closed");
    current.client = undefined;
    current.connection = undefined;
    scheduleReconnect(current);
  });

  try {
    const channel = await connection.createConfirmChannel();
    // An error the broker closes the channel with, such as a missing reply queue, also comes as an
    // event. Unheard, it would bring down the process; the connection closes and is reopened.
    channel.on("error", (error: unknown) =>
      log.error({ err: error }, "ERV Versand channel failed"),
    );
    // Without its channel the client can neither send nor receive: start over with a new connection.
    channel.on("close", () => {
      connection.close().catch(() => {});
    });
    const client = await createErvVersandClient({
      channel,
      userId: requireSecret("rabbitmq", "RABBITMQ_USER"),
      onReply,
      // Without a consumer, replies would pile up unread. A new connection starts a new one.
      onCancel: () => {
        log.error("ERV Versand reply consumer was cancelled by the broker");
        connection.close().catch(() => {});
      },
    });
    current.attempts = 0;
    log.info("ERV Versand connected");
    return client;
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
}

function scheduleReconnect(current: State): void {
  if (!current.onReply || current.retry !== undefined || state() !== current) return;
  const delay = Math.min(FIRST_RETRY_MS * 2 ** current.attempts, MAX_RETRY_MS);
  current.attempts += 1;
  current.retry = setTimeout(() => {
    current.retry = undefined;
    connected().catch(() => {
      // Logged and retried in connected().
    });
  }, delay);
  current.retry.unref?.();
}
