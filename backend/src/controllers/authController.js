import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const sessionDurationMs = 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationMs,
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    flat: user.flat
      ? {
          id: user.flat.id,
          flatNumber: user.flat.flatNumber,
          wing: user.flat.wing,
        }
      : null,
  };
}

export async function login(request, response) {
  const body =
    request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body : {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || Buffer.byteLength(password, "utf8") > 72) {
    return response.status(400).json({ message: "Enter a valid email and password." });
  }

  const user = await User.findOne({ email }).select("+passwordHash").populate("flat", "flatNumber wing");
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordMatches || !user.active) {
    return response.status(401).json({ message: "Invalid email or password." });
  }

  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "1h",
  });

  return response
    .cookie("flatflowToken", token, cookieOptions())
    .status(200)
    .json({ user: publicUser(user) });
}

export function logout(request, response) {
  const { maxAge, ...clearOptions } = cookieOptions();
  return response.clearCookie("flatflowToken", clearOptions).status(200).json({ message: "Logged out." });
}

export function currentUser(request, response) {
  return response.status(200).json({ user: publicUser(request.user) });
}
