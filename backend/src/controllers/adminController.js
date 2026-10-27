import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Flat from "../models/Flat.js";
import User from "../models/User.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function requestBody(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function listFlats(request, response) {
  const flats = await Flat.find().sort({ wing: 1, flatNumber: 1 }).lean();
  const residents = await User.find({ role: "resident", flat: { $in: flats.map((flat) => flat._id) } })
    .select("name email flat active")
    .sort({ name: 1 })
    .lean();
  const residentsByFlat = new Map();

  for (const resident of residents) {
    const key = resident.flat.toString();
    const flatResidents = residentsByFlat.get(key) || [];
    flatResidents.push({
      id: resident._id,
      name: resident.name,
      email: resident.email,
      active: resident.active,
    });
    residentsByFlat.set(key, flatResidents);
  }

  return response.status(200).json({
    flats: flats.map((flat) => ({
      id: flat._id,
      flatNumber: flat.flatNumber,
      wing: flat.wing,
      active: flat.active,
      residents: residentsByFlat.get(flat._id.toString()) || [],
    })),
  });
}

export async function createFlat(request, response) {
  const body = requestBody(request.body);
  const flatNumber = typeof body.flatNumber === "string" ? body.flatNumber.trim().toUpperCase() : "";
  const wing = typeof body.wing === "string" ? body.wing.trim().toUpperCase() : "";

  if (!flatNumber || flatNumber.length > 20 || wing.length > 20) {
    return response.status(400).json({ message: "Provide a flat number (up to 20 characters) and a wing (up to 20 characters)." });
  }

  try {
    const flat = await Flat.create({ flatNumber, wing });
    return response.status(201).json({
      flat: {
        id: flat.id,
        flatNumber: flat.flatNumber,
        wing: flat.wing,
        active: flat.active,
        residents: [],
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: "A flat with this wing and flat number already exists." });
    }
    if (error.name === "ValidationError") {
      return response.status(400).json({ message: "The flat details are invalid." });
    }
    throw error;
  }
}

export async function listResidents(request, response) {
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  const flatId = typeof request.query.flatId === "string" ? request.query.flatId : "";
  const filter = { role: "resident" };

  if (query.length > 100) {
    return response.status(400).json({ message: "Search text must be 100 characters or fewer." });
  }
  if (flatId && !mongoose.isValidObjectId(flatId)) {
    return response.status(400).json({ message: "The flat ID is invalid." });
  }
  if (flatId) filter.flat = flatId;
  if (query) {
    const escapedQuery = escapeRegex(query);
    filter.$or = [
      { name: { $regex: escapedQuery, $options: "i" } },
      { email: { $regex: escapedQuery, $options: "i" } },
    ];
  }

  const residents = await User.find(filter)
    .select("name email flat active createdAt")
    .populate("flat", "flatNumber wing")
    .sort({ name: 1 })
    .limit(100)
    .lean();

  return response.status(200).json({
    residents: residents.map((resident) => ({
      id: resident._id,
      name: resident.name,
      email: resident.email,
      flat: resident.flat
        ? {
            id: resident.flat._id,
            flatNumber: resident.flat.flatNumber,
            wing: resident.flat.wing,
          }
        : null,
      active: resident.active,
      createdAt: resident.createdAt,
    })),
  });
}

export async function createResident(request, response) {
  const body = requestBody(request.body);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const flatId = typeof body.flatId === "string" ? body.flatId : "";

  if (name.length < 2 || name.length > 100 || !emailPattern.test(email) || email.length > 254) {
    return response.status(400).json({ message: "Enter a valid resident name and email address." });
  }
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    return response.status(400).json({ message: "The initial password must be at least 12 characters and no more than 72 bytes." });
  }
  if (!mongoose.isValidObjectId(flatId)) {
    return response.status(400).json({ message: "Select a valid flat for the resident." });
  }

  const flat = await Flat.findOne({ _id: flatId, active: true });
  if (!flat) {
    return response.status(404).json({ message: "The selected flat does not exist or is inactive." });
  }

  try {
    const resident = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "resident",
      flat: flat._id,
    });

    return response.status(201).json({
      resident: {
        id: resident.id,
        name: resident.name,
        email: resident.email,
        role: resident.role,
        flat: {
          id: flat.id,
          flatNumber: flat.flatNumber,
          wing: flat.wing,
        },
        active: resident.active,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: "An account with this email address already exists." });
    }
    if (error.name === "ValidationError") {
      return response.status(400).json({ message: "The resident details are invalid." });
    }
    throw error;
  }
}
