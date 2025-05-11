import express from "express";
import dotenv from "dotenv";
import User from "../../models/User.Model.js";
import Chat from "../../models/Chat.Model.js";
import Notification from "../../models/Notification.Model.js";
import { isValidObjectId } from "mongoose";

dotenv.config();

export const push = express.Router();

// Store sockets in memory or use Redis in production
const userSockets = new Map(); // Map<userId, socketId>

// Exported methods for socket registration
export function registerUserSocket(userId, socketId) {
    userSockets.set(userId, socketId);
}

export function removeUserSocket(userId) {
    userSockets.delete(userId);
}

// Send real-time notification via socket
export async function sendPushNotification(io, userId, payload) {
    try {
        if (!isValidObjectId(userId)) return;

        const user = await User.findById(userId).select('isOnline').lean();
        if (!user || !user.isOnline) return;

        const socketId = userSockets.get(userId);
        if (!socketId) {
            console.warn(`⚠️ No socket found for user ${userId}`);
            return;
        }

        io.to(socketId).emit("notification", {
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
        });

        console.log(`✅ Sent real-time notification to user ${userId}`);
    } catch (err) {
        console.error("❌ Error sending real-time notification:", err.message);
    }
}

// Dummy subscribe route
push.post('/push/subscribe', async (req, res) => {
    const { userId } = req.user;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    const exists = await User.exists({ _id: userId });
    if (!exists) {
        return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ success: true });
});

// Dummy unsubscribe route (removes socket reference)
push.post('/push/unsubscribe', async (req, res) => {
    const { userId } = req.user;

    if (!isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    removeUserSocket(userId);
    res.status(200).json({ success: true });
});

// 📩 Route: Send message notification
push.post('/push/send-message-notification', async (req, res) => {
    const { userId } = req.user;
    const { recipientId, message, chatId } = req.body;

    if (!isValidObjectId(userId) || !isValidObjectId(recipientId) || !isValidObjectId(chatId)) {
        return res.status(400).json({ error: "Invalid data provided" });
    }

    try {
        // Validate chat existence and recipient presence
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(recipientId)) {
            return res.status(404).json({ error: "Chat not found or recipient not in chat" });
        }

        // Save notification
        const notification = await Notification.create({
            recipient: recipientId,
            sender: userId,
            message,
            chat: chatId,
            notificationType: "message"
        });

        // Emit real-time socket notification
        await sendPushNotification(req.io, recipientId, {
            title: "New Message",
            body: message,
            data: {
                chatId,
                notificationId: notification._id
            }
        });

        res.status(201).json({ success: true, notification });
    } catch (err) {
        console.error("❌ Error sending notification:", err.message);
        res.status(500).json({ error: "Internal server error" });
    }
});
