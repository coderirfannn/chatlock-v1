import express from "express";
import { login, loginShowPage, register, registerShowPage } from "../../controllers/user.controller.js";

export const userRoute = express.Router();

userRoute.get("/" ,registerShowPage)
userRoute.post("/register" , register)

userRoute.get("/login" ,loginShowPage)
userRoute.post("/login" ,login)

userRoute.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/api/v1/auth/login"); // or wherever you want to send them after logout
  });
  



