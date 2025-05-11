import { Server } from "socket.io";
import User from "../models/User.Model.js";
import Chat from "../models/chatModel.js";
import Notification from "../models/Notification.Model.js";

const onlineUsers = new Set();

export const setupChatSocket = (io) => {
  const u = io.of("/ChatLock");

  u.on("connection", async (socket) => {
    const userId = socket.handshake.auth.token;

    if (!userId) {
      socket.disconnect();
      return;
    }

    try {
      // Mark user online
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
      onlineUsers.add(userId);

      // Notify others only (not self)
      socket.broadcast.emit("user_online", userId);

      // Send full online list to the connected user
      socket.emit("online_user_list", Array.from(onlineUsers));

      socket.join(`user_${userId}`);

      // Join all relevant chats
      const userChats = await Chat.find({
        $or: [{ sender_id: userId }, { receiver_id: userId }],
      }).select("_id");

      userChats.forEach((chat) => socket.join(`chat_${chat._id}`));

      // Handle sending message
      socket.on("send_message", async ({ from, to, message }) => {
        try {
          if (!from || !to || !message) throw new Error("Missing fields");

          let chat = await Chat.findOneAndUpdate(
            {
              $or: [
                { sender_id: from, receiver_id: to },
                { sender_id: to, receiver_id: from },
              ],
            },
            {
              $setOnInsert: {
                sender_id: from,
                receiver_id: to,
                messages: [],
              },
              $push: {
                messages: {
                  sender: from,
                  content: message,
                  timestamp: new Date(),
                },
              },
              $set: { updatedAt: new Date() },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
            }
          ).populate("sender_id receiver_id", "username profilePic isOnline");

          const sender = chat.sender_id._id.equals(from)
            ? chat.sender_id
            : await User.findById(from).select("username profilePic");

          const notification = await Notification.create({
            recipient: to,
            sender: from,
            chat: chat._id,
            message,
            notificationType: "message",
          });

          const notificationData = {
            id: notification._id,
            senderId: from,
            senderName: sender.username,
            senderAvatar: sender.profilePic || "/default-avatar.png",
            chatId: chat._id.toString(),
            preview: message.length > 30 ? message.slice(0, 30) + "..." : message,
            timestamp: notification.createdAt,
            isRead: false,
          };

          await User.findByIdAndUpdate(to, {
            $inc: { unreadCount: 1 },
          });

          u.to(`chat_${chat._id}`).emit("loadNewChat", {
            from,
            to,
            message,
            chatId: chat._id,
            timestamp: new Date(),
          });

          u.to(`user_${to}`).emit("new_message_notification", notificationData);
        } catch (err) {
          console.error("send_message error:", err.message);
          socket.emit("message_error", {
            error: "Failed to send message",
            details: err.message,
          });
        }
      });

      // Mark as read
      socket.on("mark_as_read", async ({ chatId, userId }) => {
        try {
          await Notification.updateMany(
            { chat: chatId, recipient: userId, isRead: false },
            { $set: { isRead: true } }
          );

          await User.findByIdAndUpdate(userId, {
            $set: { unreadCount: 0 },
          });

          u.to(`chat_${chatId}`).emit("messages_read", {
            chatId,
            readerId: userId,
          });
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      });

      // Typing
      socket.on("typing", ({ chatId, userId }) => {
        if (chatId && userId) {
          socket.to(`chat_${chatId}`).emit("user_typing", {
            chatId,
            userId,
          });
        }
      });

      // Disconnect
      socket.on("disconnect", async () => {
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          onlineUsers.delete(userId);
          socket.broadcast.emit("user_offline", userId);
        } catch (error) {
          console.error("Disconnect error:", error);
        }
      });
    } catch (error) {
      console.error("Socket connection error:", error);
      socket.disconnect(true);
    }
  });
};
