import express from "express";
import dotenv from "dotenv";
import http from "http";
import cookieParser from "cookie-parser";
import { connetDB } from "./config/db.js";
import { userRoute } from "./routes/auth/user.router.js";
import { user } from "./routes/user/user.router.js";
import { Server } from "socket.io";
import User from "./models/User.Model.js";

dotenv.config();

const app = express();
const server = http.createServer(app); // Corrected variable name
const io = new Server(server); // Socket.IO instance

// EJS setup
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.get("/", (req, res) => {
    res.redirect("/api/v1/auth");
});

app.use("/api/v1/auth", userRoute);
app.use("/api/v1/user", user);

// Socket.IO events
// const u = io.of("/ChatLock");

// u.on("connection", async (socket) => {
//     //   console.log("New user connected to /ChatLock:", socket.id);
//     const useID = socket.handshake.auth.token;

//     await User.findByIdAndUpdate({_id:useID} ,{$set:{isOnline:"1"}})

//     //broadcasting.. to all user real time online
//     socket.broadcast.emit("getOnlineUser",{user_id:useID})

//     socket.on("send_message", (data) => {
    
//         socket.broadcast.emit('loadNewChat',data);
//     });

//     socket.on("disconnect", async () => {
//         const useID = socket.handshake.auth.token;
//         await User.findByIdAndUpdate({_id:useID} ,{$set:{isOnline:"0"}})

//     socket.broadcast.emit("getOfflineUser",{user_id:useID})

//     });
// });



// Socket.IO events
// Socket.IO events
const u = io.of("/ChatLock");

u.on("connection", async (socket) => {
    const useID = socket.handshake.auth.token;
    
    // Update user online status
    await User.findByIdAndUpdate({_id: useID}, {$set: {isOnline: "1"}});
    
    // Join a room for this user's notifications
    socket.join(`user_${useID}`);
    
    // Broadcast online status
    socket.broadcast.emit("getOnlineUser", {user_id: useID});
    
    // Handle new messages
    socket.on("send_message", async (data) => {
        // Broadcast to recipient
        socket.broadcast.emit('loadNewChat', data);
        
        // Get sender info for notification
        const sender = await User.findById(data.from).select('username profilePic');
        
        // Send notification ONLY to the recipient (not sender)
        u.to(`user_${data.to}`).emit('new_message_notification', {
            senderId: data.from,
            senderName: sender.username,
            senderAvatar: sender.profilePic,
            chatId: `${data.from}_${data.to}`, // or your actual chat ID logic
            preview: data.message.substring(0, 30),
            timestamp: new Date()
        });
    
    // Handle disconnection
    socket.on("disconnect", async () => {
        await User.findByIdAndUpdate({_id: useID}, {$set: {isOnline: "0"}});
        socket.broadcast.emit("getOfflineUser", {user_id: useID});
    });
});
    // Handle disconnection
    socket.on("disconnect", async () => {
        const useID = socket.handshake.auth.token;
        await User.findByIdAndUpdate({_id:useID}, {$set:{isOnline:"0"}});
        socket.broadcast.emit("getOfflineUser", {user_id:useID});
    });
});

// Server start
server.listen(process.env.PORT, () => {
    connetDB();
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
