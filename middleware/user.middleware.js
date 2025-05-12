import jwt from "jsonwebtoken";
import User from "../models/User.Model.js";

export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect("/api/v1/auth/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return res.redirect("/api/v1/auth/login");
    }

    if (user.blockExpires && user.blockExpires > new Date()) {
      return res
        .status(403)
        .send("Your account is temporarily blocked due to too many failed login attempts. Please try again later.");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.redirect("/api/v1/auth/login");
  }
};
