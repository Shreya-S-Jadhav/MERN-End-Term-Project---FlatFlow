import assert from "node:assert/strict";
import test from "node:test";
import { validateDisputeInput, validateDisputeUpdate } from "../src/controllers/disputeController.js";

const validId = "507f1f77bcf86cd799439011";

test("dispute submission validates bill, category, subject, and description", () => {
  const valid = validateDisputeInput({
    billId: validId,
    category: "incorrect_amount",
    subject: "Amount looks incorrect",
    description: "The amount differs from the notice I received.",
  });
  assert.equal(valid.error, undefined);
  assert.equal(valid.input.billId, validId);
  assert.equal(validateDisputeInput({ billId: "invalid" }).error, "Select a valid bill to dispute.");
  assert.match(validateDisputeInput({ billId: validId, category: "unknown", subject: "A subject", description: "A sufficiently long explanation." }).error, /category/);
  assert.match(validateDisputeInput({ billId: validId, category: "other", subject: "x", description: "A sufficiently long explanation." }).error, /subject/);
  assert.match(validateDisputeInput({ billId: validId, category: "other", subject: "Valid subject", description: "short" }).error, /description/);
});

test("admin can move open disputes to review or closure but cannot reopen or edit closed disputes", () => {
  assert.equal(validateDisputeUpdate({ status: "under_review" }, "open").update.status, "under_review");
  assert.equal(validateDisputeUpdate({ status: "resolved", adminResponse: "Amount corrected." }, "open").update.status, "resolved");
  assert.match(validateDisputeUpdate({ status: "resolved" }, "open").error, /response/);
  assert.match(validateDisputeUpdate({ status: "open" }, "under_review").error, /valid next/);
  assert.match(validateDisputeUpdate({ status: "rejected", adminResponse: "Incorrect" }, "resolved").error, /closed/);
});
