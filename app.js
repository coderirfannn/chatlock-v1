import express from "express";
import dotenv from "dotenv";
import http from "http";
import cookieParser from "cookie-parser";
import { connetDB } from "./config/db.js";
import { userRoute } from "./routes/auth/user.router.js";
import { user } from "./routes/user/user.router.js";
import { Server } from "socket.io";
import { setupChatSocket } from "./controllers/socket.js";


dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // For production, specify frontend domain
    methods: ["GET", "POST"]
  }
});

// EJS Setup
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public")); // For service worker, images, etc.

// Basic Routes
app.get("/", (req, res) => {
  res.redirect("/api/v1/auth");
});

import { profile_router } from "./routes/setting/profile.js";


app.use("/api/v1/auth", userRoute);
app.use("/api/v1/user", user);
app.use("/api/v1/user", profile_router)

// Attach ChatLock namespace logic
setupChatSocket(io);


server.listen(process.env.PORT, () => {
  connetDB();
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});
