import jwt from "jsonwebtoken";
import User from "../models/User.Model.js";

export const requireAuth = async (req, res, next) => {
  const token = req.cookies.token;

  // 1. If no token, redirect to login
  if (!token) {
    return res.redirect("/api/v1/auth/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.clearCookie("token").redirect("/api/v1/auth/login");
    }

    // 2. Check if account is blocked
    if (user.blockExpires && user.blockExpires > new Date()) {
      return res.status(403).send("Your account is blocked due to too many failed attempts. Try again later.");
    }

    // 3. Attach user to request for next handlers
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie("token").redirect("/api/v1/auth/login");
  }
};
