/**
 * Message payload types of the Basisdienst: ERV Versand, written by hand after
 * the Basisdienst's specifications. Their schemas remain the source of truth.
 * Update these types whenever the schemas change.
 */

// ---------------------------------------------------------------------------
// Request messages
// ---------------------------------------------------------------------------

/** Payload of `de.justiz.basisdienst.erv.send-egvp-message.v1` */
export type SendEgvpMessage = {
  /** Target identity where to send the message to */
  receiver: SafeId;
  xjustizMessage: DataArtifact;
  /**
   * Optional list of attachments to send with the message. Attachments should
   * be referenced in the XJustiz message.
   */
  attachments?: Attachment[];
};

/** Payload of `de.justiz.basisdienst.erv.send-egvp-example-message.v1` */
export type SendEgvpExampleMessage = {
  /** Target identity where to send the static example message to */
  receiver: SafeId;
};

// ---------------------------------------------------------------------------
// Reply messages
// ---------------------------------------------------------------------------

/**
 * Payload of `de.justiz.basisdienst.erv.egvp-message-sent.v1`. The schema
 * defines no properties yet.
 */
export type EgvpMessageSent = Record<string, unknown>;

/**
 * Payload of `de.justiz.basisdienst.erv.send-egvp-message-failed.v1` and
 * `de.justiz.basisdienst.erv.send-egvp-example-message-failed.v1`.
 *
 * Use the type guards {@link isPayloadInvalid} and {@link isReceiverUnknown} to
 * branch. Everything else is an {@link UnknownProblem}, which consumers must
 * always handle for forward compatibility.
 */
export type SendEgvpMessageFailed = PayloadInvalid | ReceiverUnknown | UnknownProblem;

// ---------------------------------------------------------------------------
// Problems (RFC 9457 Problem Details)
// ---------------------------------------------------------------------------

export const PAYLOAD_INVALID_TYPE =
  "https://schemas.service.justiz.de/basisdienst/erv/problems/payload-invalid";

export const RECEIVER_UNKNOWN_TYPE =
  "https://schemas.service.justiz.de/basisdienst/erv/problems/receiver-unknown";

/**
 * The payload of the request message does not conform to the payload schema of
 * its message type. Not retryable: fix the payload before sending again.
 */
export type PayloadInvalid = {
  type: typeof PAYLOAD_INVALID_TYPE;
  title: "Payload Invalid";
  /** All schema violations found in the payload */
  errors: [PayloadViolation, ...PayloadViolation[]];
} & ProblemDetails;

export type PayloadViolation = {
  /** JSON Pointer (RFC 6901) in URI fragment form, e.g. `#/attachments/2/name` */
  pointer: string;
  /** Human-readable explanation for logs. Do not parse. */
  detail: string;
};

/** The target receiver does not exist. Not retryable: change the receiver. */
export type ReceiverUnknown = {
  type: typeof RECEIVER_UNKNOWN_TYPE;
  title: "Receiver Unknown";
} & ProblemDetails;

/**
 * Any problem whose type is not part of the catalog above, including problem
 * types introduced after this client was written.
 */
export type UnknownProblem = ProblemDetails;

/** Base of all problems. `status` and `instance` are omitted by design. */
export type ProblemDetails = {
  /** Absolute URI identifying the problem type. Stable, safe to branch on. */
  type: string;
  /** Short summary, fixed per problem type */
  title: string;
  /** Explanation of this occurrence for logs. Do not parse. */
  detail?: string;
};

export function isPayloadInvalid(problem: ProblemDetails): problem is PayloadInvalid {
  return problem.type === PAYLOAD_INVALID_TYPE;
}

export function isReceiverUnknown(problem: ProblemDetails): problem is ReceiverUnknown {
  return problem.type === RECEIVER_UNKNOWN_TYPE;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Identifier of an EGVP participant from the SAFE identity management system:
 * `<country-code>.<domain>.<UUID>.<check-digits>`. The template literal type
 * only checks the rough shape; use {@link isSafeId} for the exact pattern.
 *
 * @example "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740"
 */
export type SafeId = `DE.${string}.${string}.${string}`;

export function isSafeId(value: string): value is SafeId {
  return SAFE_ID_PATTERN.test(value);
}

const SAFE_ID_PATTERN =
  /^DE\.[a-zA-Z0-9_-]+\.[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\.[a-fA-F0-9]{4}$/;

/**
 * Data that is either embedded as Base64 encoded blob or referenced by an
 * HTTPS URI to download it from (Claim Check Pattern).
 */
export type DataArtifact = EmbeddedData | ReferencedData;

export type EmbeddedData = {
  /** Base64 encoded content */
  content: string;
  uri?: never;
  size?: never;
  digest?: never;
};

export type ReferencedData = {
  /** Only HTTPS references are supported. */
  uri: `https://${string}`;
  /** Size of the artifact in bytes, at least 1 */
  size: number;
  /** SHA256 hash of the raw bytes, hex encoded, e.g. `sha256:cd42…` */
  digest: `sha256:${string}`;
  content?: never;
};

/**
 * A file attached to an EGVP message, referenced within the XJustiz message.
 */
export type Attachment = DataArtifact & {
  /**
   * File name as referenced in the XJustiz message, at most 90 characters.
   * Recommended pattern: `<descriptive-name>_<UUID>.<file-extension>`.
   */
  name: string;
};
