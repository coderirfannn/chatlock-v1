import express from "express";
import { getChatHistory, progilePic, saveChat, SetprogilePic, showChatPage } from "../../controllers/user.controller.js";
import { requireAuth } from "../../middleware/user.middleware.js";
import multer from "multer";
import User from "../../models/User.Model.js";
import Notification from "../../models/Notification.Model.js";
import Chat from "../../models/chatModel.js";

export const user = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });


user.get("/set/profile" ,requireAuth,progilePic)

user.post("/upload-profile",requireAuth ,upload.single("profilePic"), SetprogilePic)

user.get("/chating" ,requireAuth ,showChatPage)

user.post("/save-chat", requireAuth,saveChat)



user.get('/users', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser._id;

    // Fetch unread global notifications (like alerts or system messages)
    const notifications = await Notification.find({ userId, read: false }).sort({ createdAt: -1 });

    // Fetch all users except current user
    const users = await User.find({ _id: { $ne: userId } });

    // Fetch unread chat message count per user
    const usersWithUnread = await Promise.all(
      users.map(async (u) => {
        const unreadCount = await Chat.countDocuments({
          senderId: u._id,
          receiverId: userId,
          isRead: false
        });

        return {
          ...u.toObject(),
          unreadCount
        };
      })
    );

    res.render('message/users', {
      allUser: usersWithUnread,
      user: currentUser,
      notifications,                  // for dropdown or alert notifications
      unreadCount: notifications.length // for global badge count
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).send('Server Error');
  }
});

user.get('/notifications-all', requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: notifications.length,
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

user.post('/notifications/mark-all-read', requireAuth ,async (req, res) => {
  try {
    await Chat.updateMany(
      { receiverId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




      
  


  user.get('/chat/:id', requireAuth , async (req, res) => {
    const user = await User.findById(req.params.id);
    const currentUser = req.user;
    // res.send(user)
    // console.log(currentUser);
    
    res.render('message/chatt', { user, currentUser });
  });


  user.get("/chat/:user1/:user2" , requireAuth ,getChatHistory);


