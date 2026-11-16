import { MAX_BODY_BYTES } from "../app/lib/body-limit.ts";
import { BASE_PATH, expect, test } from "./fixtures.ts";

test("a request body over the limit is rejected before the app reads it", async ({ request }) => {
  const response = await request.post(`${BASE_PATH}/`, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: "a".repeat(MAX_BODY_BYTES + 1),
  });
  expect(response.status()).toBe(413);
});
