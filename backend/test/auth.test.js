import assert from "node:assert/strict";
import test from "node:test";
import { requireAuth, requireRole } from "../src/middleware/auth.js";

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("requireAuth rejects a request without a session cookie", async () => {
  const response = createResponse();
  let continued = false;

  await requireAuth({ cookies: {} }, response, () => {
    continued = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);
});

test("requireRole denies residents access to admin resources", () => {
  const response = createResponse();
  let continued = false;

  requireRole("admin")({ user: { role: "resident" } }, response, () => {
    continued = true;
  });

  assert.equal(response.statusCode, 403);
  assert.equal(continued, false);
});

test("requireRole allows a user with the required role", () => {
  const response = createResponse();
  let continued = false;

  requireRole("admin")({ user: { role: "admin" } }, response, () => {
    continued = true;
  });

  assert.equal(response.statusCode, null);
  assert.equal(continued, true);
});
