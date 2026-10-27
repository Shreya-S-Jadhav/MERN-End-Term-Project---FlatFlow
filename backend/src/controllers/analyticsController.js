import Bill from "../models/Bill.js";

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const maximumRangeMonths = 24;

function currentSocietyPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function periodIndex(period) {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + month - 1;
}

function periodFromIndex(index) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseAnalyticsRange(query, currentPeriod = currentSocietyPeriod()) {
  const to = query.to === undefined ? currentPeriod : query.to;
  const from = query.from === undefined
    ? periodFromIndex(periodIndex(to) - 11)
    : query.from;

  if (typeof from !== "string" || !periodPattern.test(from)) {
    return { error: "Start period must use YYYY-MM format." };
  }
  if (typeof to !== "string" || !periodPattern.test(to)) {
    return { error: "End period must use YYYY-MM format." };
  }

  const range = periodIndex(to) - periodIndex(from) + 1;
  if (range < 1) {
    return { error: "Start period must not be after end period." };
  }
  if (range > maximumRangeMonths) {
    return { error: `Choose a range of no more than ${maximumRangeMonths} months.` };
  }

  return {
    from,
    to,
    periods: Array.from({ length: range }, (_, index) => periodFromIndex(periodIndex(from) + index)),
  };
}

export function summarizeCollectionPeriods(rows, periods) {
  const rowsByPeriod = new Map(rows.map((row) => [row._id, row]));
  const monthly = periods.map((period) => {
    const row = rowsByPeriod.get(period);
    return {
      billingPeriod: period,
      billCount: row?.billCount || 0,
      paidBillCount: row?.paidBillCount || 0,
      unpaidBillCount: row?.unpaidBillCount || 0,
      overdueBillCount: row?.overdueBillCount || 0,
      billedPaise: row?.billedPaise || 0,
      collectedPaise: row?.collectedPaise || 0,
      outstandingPaise: row?.outstandingPaise || 0,
      overduePaise: row?.overduePaise || 0,
    };
  });

  return {
    totals: monthly.reduce(
      (totals, month) => ({
        billCount: totals.billCount + month.billCount,
        paidBillCount: totals.paidBillCount + month.paidBillCount,
        unpaidBillCount: totals.unpaidBillCount + month.unpaidBillCount,
        overdueBillCount: totals.overdueBillCount + month.overdueBillCount,
        billedPaise: totals.billedPaise + month.billedPaise,
        collectedPaise: totals.collectedPaise + month.collectedPaise,
        outstandingPaise: totals.outstandingPaise + month.outstandingPaise,
        overduePaise: totals.overduePaise + month.overduePaise,
      }),
      {
        billCount: 0,
        paidBillCount: 0,
        unpaidBillCount: 0,
        overdueBillCount: 0,
        billedPaise: 0,
        collectedPaise: 0,
        outstandingPaise: 0,
        overduePaise: 0,
      },
    ),
    monthly,
  };
}

export async function getCollectionAnalytics(request, response) {
  const parsed = parseAnalyticsRange(request.query);
  if (parsed.error) return response.status(400).json({ message: parsed.error });

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const overdueCutoff = new Date(`${today}T00:00:00.000Z`);

  const rows = await Bill.aggregate([
    { $match: { billingPeriod: { $gte: parsed.from, $lte: parsed.to } } },
    {
      $group: {
        _id: "$billingPeriod",
        billCount: { $sum: 1 },
        paidBillCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        unpaidBillCount: { $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] } },
        overdueBillCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "unpaid"] }, { $lt: ["$dueDate", overdueCutoff] }] },
              1,
              0,
            ],
          },
        },
        billedPaise: { $sum: "$amountPaise" },
        collectedPaise: {
          $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amountPaise", 0] },
        },
        outstandingPaise: {
          $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, "$amountPaise", 0] },
        },
        overduePaise: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "unpaid"] }, { $lt: ["$dueDate", overdueCutoff] }] },
              "$amountPaise",
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const report = summarizeCollectionPeriods(rows, parsed.periods);

  return response.status(200).json({
    range: { from: parsed.from, to: parsed.to },
    ...report,
  });
}
