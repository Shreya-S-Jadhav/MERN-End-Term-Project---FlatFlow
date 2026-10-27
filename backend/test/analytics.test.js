import assert from "node:assert/strict";
import test from "node:test";
import { parseAnalyticsRange, summarizeCollectionPeriods } from "../src/controllers/analyticsController.js";

test("analytics range defaults to the latest 12 months and fills calendar boundaries", () => {
  const range = parseAnalyticsRange({}, "2026-10");
  assert.equal(range.from, "2025-11");
  assert.equal(range.to, "2026-10");
  assert.equal(range.periods.length, 12);
  assert.equal(range.periods[0], "2025-11");
  assert.equal(range.periods[11], "2026-10");
});

test("analytics range validates formats, order, and the maximum duration", () => {
  assert.match(parseAnalyticsRange({ from: "2026-1", to: "2026-10" }).error, /YYYY-MM/);
  assert.match(parseAnalyticsRange({ from: "2026-11", to: "2026-10" }).error, /after/);
  assert.match(parseAnalyticsRange({ from: "2024-01", to: "2026-01" }).error, /24 months/);
  assert.equal(parseAnalyticsRange({ from: "2025-01", to: "2026-12" }).periods.length, 24);
});

test("collection summary fills empty months and adds authoritative bill totals", () => {
  const report = summarizeCollectionPeriods(
    [{
      _id: "2026-01",
      billCount: 3,
      paidBillCount: 1,
      unpaidBillCount: 2,
      overdueBillCount: 1,
      billedPaise: 30000,
      collectedPaise: 10000,
      outstandingPaise: 20000,
      overduePaise: 12000,
    }],
    ["2026-01", "2026-02"],
  );
  assert.equal(report.monthly.length, 2);
  assert.equal(report.monthly[1].billCount, 0);
  assert.equal(report.totals.billCount, 3);
  assert.equal(report.totals.collectedPaise, 10000);
  assert.equal(report.totals.overduePaise, 12000);
});
