import express from "express";
import dotenv from "dotenv";
import http from "http";
import cookieParser from "cookie-parser";
import { connetDB } from "./config/db.js";
import { userRoute } from "./routes/auth/user.router.js";
import { user } from "./routes/user/user.router.js";
import { Server } from "socket.io";
import User from "./models/User.Model.js";
// import Chat from "./models/Chat.Model.js"; // make sure Chat model is imported



import { push } from "./routes/notification/push.js";
// import { Notification } from "./models/Notification.Model.js"; // Import Notification model

import webPush from "web-push"; // Import web-push for mobile notifications
import Notification from "./models/Notification.Model.js";
import Chat from "./models/chatModel.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure web-push
webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// EJS setup
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public")); // Serve static files for service worker

// Routes
app.get("/", (req, res) => {
    res.redirect("/api/v1/auth");
});

app.use("/api/v1/auth", userRoute);
app.use("/api/v1/user", user);
app.use("/api", push);

// Socket.IO events
const u = io.of("/ChatLock");

u.on("connection", async (socket) => {
    const useID = socket.handshake.auth.token;

    // Update user online status
    await User.findByIdAndUpdate({ _id: useID }, { $set: { isOnline: "1" } });

    // Join a room for this user's notifications
    socket.join(`user_${useID}`);

    // Broadcast online status
    socket.broadcast.emit("getOnlineUser", { user_id: useID });

    // Handle new messages

socket.on("send_message", async (data) => {
    try {
        // Broadcast to recipient
        socket.broadcast.emit('loadNewChat', data);

        const { from, to, message } = data;

        // Find or create a Chat document
        let chat = await Chat.findOne({
            $or: [
                { sender_id: from, receiver_id: to },
                { sender_id: to, receiver_id: from }
            ]
        });

        if (!chat) {
            chat = await Chat.create({ sender_id: from, receiver_id: to, message });
        }

        // Get sender info
        const sender = await User.findById(from).select('username profilePic pushSubscription');

        // Save notification
        const notification = new Notification({
            recipient: to,
            sender: from,
            chat: chat._id, // ✅ now a valid ObjectId
            message: 'You received a new message!',
            notificationType: 'message'
        });
        await notification.save();

        // Prepare notification data
        const notificationData = {
            id: notification._id,
            senderId: from,
            senderName: sender.username,
            senderAvatar: sender.profilePic,
            chatId: chat._id.toString(),
            preview: message.substring(0, 30),
            timestamp: notification.createdAt,
            isRead: false
        };

        // Send notification to recipient via socket
        u.to(`user_${to}`).emit('new_message_notification', notificationData);

        // Push notification
        if (sender.pushSubscription) {
            try {
                await webPush.sendNotification(
                    sender.pushSubscription,
                    JSON.stringify({
                        title: `New message from ${sender.username}`,
                        body: message.substring(0, 100),
                        icon: sender.profilePic || '/default-avatar.png',
                        data: { url: `/chat/${chat._id}` }
                    })
                );
            } catch (err) {
                console.error('Push notification failed:', err);
                if (err.statusCode === 410) {
                    await User.findByIdAndUpdate(to, { $unset: { pushSubscription: 1 } });
                }
            }
        }

    } catch (error) {
        console.error("Error in send_message:", error.message);
    }
});


    // Handle disconnection
    socket.on("disconnect", async () => {
        await User.findByIdAndUpdate({ _id: useID }, { $set: { isOnline: "0" } });
        socket.broadcast.emit("getOfflineUser", { user_id: useID });
    });
});

// Server start
server.listen(process.env.PORT, () => {
    connetDB();
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});