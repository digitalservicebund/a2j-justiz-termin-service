import { BASE_PATH, expect, test } from "./fixtures.ts";

test("the RabbitMQ health check logs in to the broker", async ({ request }) => {
  const response = await request.get(`${BASE_PATH}/health/rabbitmq`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
