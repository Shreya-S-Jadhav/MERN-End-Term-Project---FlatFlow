import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(request, response, next) {
  const token = request.cookies?.flatflowToken;

  if (!token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return response.status(401).json({ message: "Your session is invalid or has expired." });
  }

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    return response.status(401).json({ message: "Your session is invalid or has expired." });
  }

  const user = await User.findById(payload.sub).populate("flat", "flatNumber wing");

  if (!user || !user.active) {
    return response.status(401).json({ message: "This account is unavailable." });
  }

  request.user = user;
  return next();
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ message: "You do not have permission to access this resource." });
    }

    return next();
  };
}
