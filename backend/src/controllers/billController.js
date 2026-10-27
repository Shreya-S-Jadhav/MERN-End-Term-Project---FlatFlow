import Bill from "../models/Bill.js";
import Flat from "../models/Flat.js";
import User from "../models/User.js";

const billingPeriodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const amountPattern = /^\d{1,8}(?:\.\d{1,2})?$/;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const allowedStatuses = new Set(["unpaid", "overdue", "paid"]);
const sortFields = new Set(["dueDate", "billingPeriod", "amountPaise"]);

function parseDate(value) {
  if (typeof value !== "string" || !datePattern.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function societyTodayStart() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${today}T00:00:00.000Z`);
}

function parseAmount(value) {
  if (typeof value !== "string" || !amountPattern.test(value)) return null;
  const [rupees, paise = ""] = value.split(".");
  return Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
}

function mapBill(bill, residentsByFlat = new Map()) {
  const flat = bill.flat;
  const status =
    bill.status === "paid"
      ? "paid"
      : bill.dueDate < societyTodayStart()
        ? "overdue"
        : "unpaid";

  return {
    id: bill._id,
    billNumber: bill.billNumber,
    billingPeriod: bill.billingPeriod,
    amountPaise: bill.amountPaise,
    issueDate: bill.issueDate.toISOString().slice(0, 10),
    dueDate: bill.dueDate.toISOString().slice(0, 10),
    status,
    flat: flat
      ? {
          id: flat._id,
          flatNumber: flat.flatNumber,
          wing: flat.wing,
          residents: residentsByFlat.get(flat._id.toString()) || [],
        }
      : null,
  };
}

function parseListFilters(query) {
  const { status, billingPeriod, dueFrom, dueTo, minAmount, maxAmount, sort = "dueDate", order = "asc" } = query;

  if (status && !allowedStatuses.has(status)) {
    return { error: "Status must be unpaid, overdue, or paid." };
  }
  if (billingPeriod && !billingPeriodPattern.test(billingPeriod)) {
    return { error: "Billing period must use YYYY-MM format." };
  }
  const parsedDueFrom = dueFrom ? parseDate(dueFrom) : null;
  const parsedDueTo = dueTo ? parseDate(dueTo) : null;
  if ((dueFrom && !parsedDueFrom) || (dueTo && !parsedDueTo)) {
    return { error: "Due-date filters must be valid dates in YYYY-MM-DD format." };
  }
  if (parsedDueFrom && parsedDueTo && parsedDueFrom > parsedDueTo) {
    return { error: "The due-date start must not be after the due-date end." };
  }
  if (minAmount && parseAmount(minAmount) === null) {
    return { error: "Minimum amount must be a valid amount with at most two decimal places." };
  }
  if (maxAmount && parseAmount(maxAmount) === null) {
    return { error: "Maximum amount must be a valid amount with at most two decimal places." };
  }
  if (minAmount && maxAmount && parseAmount(minAmount) > parseAmount(maxAmount)) {
    return { error: "Minimum amount must not exceed maximum amount." };
  }
  if (!sortFields.has(sort) || !["asc", "desc"].includes(order)) {
    return { error: "Sort by dueDate, billingPeriod, or amount; order must be asc or desc." };
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return { error: "Page must be an integer between 1 and 10000." };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { error: "Limit must be an integer between 1 and 100." };
  }

  return {
    filters: {
      status,
      billingPeriod,
      dueFrom: parsedDueFrom,
      dueTo: parsedDueTo,
      minAmountPaise: minAmount ? parseAmount(minAmount) : null,
      maxAmountPaise: maxAmount ? parseAmount(maxAmount) : null,
      sort,
      order,
      page,
      limit,
      search: typeof query.q === "string" ? query.q.trim() : "",
    },
  };
}

function buildMongoFilter(filters, flatIds) {
  const mongoFilter = {};
  if (flatIds) mongoFilter.flat = { $in: flatIds };
  if (filters.billingPeriod) mongoFilter.billingPeriod = filters.billingPeriod;

  if (filters.status === "paid") {
    mongoFilter.status = "paid";
  } else if (filters.status === "unpaid") {
    mongoFilter.status = "unpaid";
    mongoFilter.dueDate = { $gte: societyTodayStart() };
  } else if (filters.status === "overdue") {
    mongoFilter.status = "unpaid";
    mongoFilter.dueDate = { $lt: societyTodayStart() };
  }

  if (filters.dueFrom || filters.dueTo) {
    const dueDate = mongoFilter.dueDate || {};
    if (filters.dueFrom && (!dueDate.$gte || filters.dueFrom > dueDate.$gte)) {
      dueDate.$gte = filters.dueFrom;
    }
    const dueToExclusive = filters.dueTo
      ? new Date(filters.dueTo.getTime() + 24 * 60 * 60 * 1000)
      : null;
    if (dueToExclusive && (!dueDate.$lt || dueToExclusive < dueDate.$lt)) {
      dueDate.$lt = dueToExclusive;
    }
    mongoFilter.dueDate = dueDate;
  }
  if (filters.minAmountPaise !== null || filters.maxAmountPaise !== null) {
    mongoFilter.amountPaise = {};
    if (filters.minAmountPaise !== null) mongoFilter.amountPaise.$gte = filters.minAmountPaise;
    if (filters.maxAmountPaise !== null) mongoFilter.amountPaise.$lte = filters.maxAmountPaise;
  }
  return mongoFilter;
}

export async function generateBills(request, response) {
  const body =
    request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body : {};
  const billingPeriod = typeof body.billingPeriod === "string" ? body.billingPeriod : "";
  const dueDate = parseDate(body.dueDate);
  const issueDate =
    body.issueDate === undefined
      ? societyTodayStart()
      : parseDate(body.issueDate);
  const amountPaise = parseAmount(body.amount);

  if (!billingPeriodPattern.test(billingPeriod)) {
    return response.status(400).json({ message: "Billing period must use YYYY-MM format." });
  }
  if (amountPaise === null || amountPaise < 1) {
    return response.status(400).json({ message: "Amount must be greater than zero and have at most two decimal places." });
  }
  if (!issueDate || !dueDate || dueDate < issueDate) {
    return response.status(400).json({ message: "Provide valid issue and due dates; the due date must not be before the issue date." });
  }

  const activeFlats = await Flat.find({ active: true }).select("_id").lean();
  if (activeFlats.length === 0) {
    return response.status(200).json({ created: 0, skipped: 0, bills: [] });
  }

  const operations = activeFlats.map(({ _id }) => ({
    insertOne: {
      document: {
        billNumber: `FF-${billingPeriod.replace("-", "")}-${_id.toString().toUpperCase()}`,
        flat: _id,
        billingPeriod,
        amountPaise,
        issueDate,
        dueDate,
        status: "unpaid",
      },
    },
  }));

  let created = 0;
  let skipped = 0;
  try {
    const result = await Bill.bulkWrite(operations, { ordered: false });
    created = result.insertedCount;
  } catch (error) {
    const writeErrors = error.writeErrors || error.result?.getWriteErrors?.() || [];
    const duplicateErrors = writeErrors.filter((writeError) => writeError.code === 11000);
    if (duplicateErrors.length !== writeErrors.length) throw error;
    created = error.result?.insertedCount || 0;
    skipped = duplicateErrors.length;
  }

  const bills = await Bill.find({ billingPeriod, flat: { $in: activeFlats.map((flat) => flat._id) } })
    .populate("flat", "flatNumber wing")
    .sort({ "flat.wing": 1, "flat.flatNumber": 1 })
    .lean();

  return response.status(201).json({
    created,
    skipped,
    bills: bills.map((bill) => mapBill(bill)),
  });
}

async function listBills(request, response, flatIds) {
  const parsed = parseListFilters(request.query);
  if (parsed.error) return response.status(400).json({ message: parsed.error });
  const { filters } = parsed;
  const mongoFilter = buildMongoFilter(filters, flatIds);

  if (filters.search.length > 100) {
    return response.status(400).json({ message: "Search text must be 100 characters or fewer." });
  }
  if (filters.search) {
    const escapedSearch = escapeRegex(filters.search);
    const matchingFlats = await Flat.find({
      $or: [
        { flatNumber: { $regex: escapedSearch, $options: "i" } },
        { wing: { $regex: escapedSearch, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const searchFlatIds = matchingFlats.map((flat) => flat._id);
    if (!flatIds) {
      const matchingResidents = await User.find({
        role: "resident",
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
        ],
      })
        .select("flat")
        .lean();
      searchFlatIds.push(...matchingResidents.map((resident) => resident.flat).filter(Boolean));
    }
    const matchingBills = [
      { billNumber: { $regex: escapedSearch, $options: "i" } },
      ...(searchFlatIds.length > 0 ? [{ flat: { $in: searchFlatIds } }] : []),
    ];
    if (flatIds) {
      mongoFilter.$and = [{ $or: matchingBills }, { flat: { $in: flatIds } }];
      delete mongoFilter.flat;
    } else {
      mongoFilter.$or = matchingBills;
    }
  }

  const sortDirection = filters.order === "asc" ? 1 : -1;
  const sort = { [filters.sort]: sortDirection, _id: 1 };
  const [total, bills] = await Promise.all([
    Bill.countDocuments(mongoFilter),
    Bill.find(mongoFilter)
      .populate("flat", "flatNumber wing")
      .sort(sort)
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
  ]);
  let residentsByFlat = new Map();

  if (!flatIds && bills.length > 0) {
    const residents = await User.find({
      role: "resident",
      flat: { $in: bills.map((bill) => bill.flat._id) },
    })
      .select("name flat")
      .lean();
    residentsByFlat = new Map();
    for (const resident of residents) {
      const key = resident.flat.toString();
      const names = residentsByFlat.get(key) || [];
      names.push(resident.name);
      residentsByFlat.set(key, names);
    }
  }

  return response.status(200).json({
    bills: bills.map((bill) => mapBill(bill, residentsByFlat)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
    },
  });
}

export async function listResidentBills(request, response) {
  if (!request.user.flat) {
    return response.status(200).json({
      bills: [],
      pagination: { page: 1, limit: 25, total: 0, pages: 0 },
    });
  }
  return listBills(request, response, [request.user.flat._id || request.user.flat]);
}

export async function listAdminBills(request, response) {
  return listBills(request, response, null);
}
