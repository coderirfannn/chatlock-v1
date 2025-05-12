
import express from "express";
import { getChatHistory, progilePic, saveChat, SetprogilePic, showChatPage } from "../../controllers/user.controller.js";
import { requireAuth } from "../../middleware/user.middleware.js";
import multer from "multer";
import User from "../../models/User.Model.js";
import Notification from "../../models/Notification.Model.js";
import Chat from "../../models/chatModel.js";
import mongoose from "mongoose";

export const user = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });


user.get("/set/profile", requireAuth, progilePic)

user.post("/upload-profile", requireAuth, upload.single("profilePic"), SetprogilePic)

user.get("/chating", requireAuth, showChatPage)

user.post("/save-chat", requireAuth, saveChat)




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
      unreadCount: notifications.length,
      
      query: req.query // for global badge count
    });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).send('Server Error');
  }
});



user.get('/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCounts = await Chat.aggregate([
      {
        $match: {
          receiverId: userId,
          isRead: false
        }
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          senderId: '$_id',
          count: 1
        }
      }
    ]);

    const unreadCountsMap = {};
    unreadCounts.forEach(({ senderId, count }) => {
      unreadCountsMap[senderId] = count;
    });

    res.json({
      success: true,
      unreadCounts: unreadCountsMap
    });
  } catch (err) {
    console.error('Error fetching unread counts:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread counts'
    });
  }
});



user.post('/api/v1/user/messages/mark-read/:senderId', requireAuth, async (req, res) => {
  const { senderId } = req.params;
  const userId = req.user._id;

  try {
    // Mark messages as read
    await Chat.updateMany(
      { senderId, recipientId: userId, read: false },
      { $set: { read: true } }
    );

    // Update unread count
    await User.updateOne(
      { _id: userId },
      { $set: { [`unreadCounts.${senderId}`]: 0 } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
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


user.post("/mark-seen", async (req, res) => {
    const { senderId, receiverId } = req.body;

    try {
        const result = await Chat.updateMany(
            { sender_id: senderId, receiver_id: receiverId, seen: false },
            { $set: { seen: true } }
        );
        res.status(200).json({ message: "Messages marked as seen", updated: result.nModified });
    } catch (err) {
        res.status(500).json({ error: "Failed to mark messages as seen" });
    }
});


user.post('/notifications/mark-chat-read/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user.id;

    await Notification.updateMany(
      { user: currentUser, 'senderDetails._id': userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});




user.post('/notifications/mark-viewed', requireAuth, async (req, res) => {
  try {
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Mark all unread notifications as read
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false
      },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as viewed`
    });
  } catch (error) {
    console.error('Error marking notifications as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notifications as viewed',
      error: error.message
    });
  }
});






user.post('/notifications/:id/mark-viewed', requireAuth, async (req, res) => {
  const notificationId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    return res.status(400).json({ success: false, message: 'Invalid notification ID' });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as viewed',
      notification
    });
  } catch (error) {
    console.error('Error marking single notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



user.post('/notifications/mark-all-read', requireAuth, async (req, res) => {
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








user.get('/chat/:id', requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  const currentUser = req.user;
  // res.send(user)
  // console.log(currentUser);

  res.render('message/chatt', { user, currentUser ,query: req.query });
});


user.get("/chat/:user1/:user2", requireAuth, getChatHistory);





// user.post('/favourite/:userId', requireAuth, async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const currentUserId = req.user._id;

//     const userToAdd = await User.findById(userId);
//     if (!userToAdd) {
//       return res.redirect('/users?error=UserNotFound');
//     }

//     const currentUser = await User.findById(currentUserId);
//     if (currentUser.favouriteUsers.includes(userId)) {
//       return res.redirect('/users?error=AlreadyFavourited');
//     }

//     currentUser.favouriteUsers.push(userId);
//     await currentUser.save();

//     res.redirect('/users?success=Favourited');
//   } catch (error) {
//     console.error(error);
//     res.redirect('/users?error=ServerError');
//   }
// });





user.get('/favourate', requireAuth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate('favouriteUsers');
    const userId = req.user._id;

    // Fetch unread global notifications
    const notifications = await Notification.find({ userId, read: false }).sort({ createdAt: -1 });

    const favourites = await Promise.all(
      currentUser.favouriteUsers.map(async (u) => {
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

    res.render('message/favourites', {
      currentUser,
      favourites,
      notifications
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


// user.post('/favourate/:id', requireAuth, async (req, res) => {
//   try {
//     const targetUser = await User.findById(req.params.id);
//     if (!targetUser) return res.status(404).send('User not found');

//     if (req.user._id.toString() === req.params.id) {
//       return res.status(400).send("You can't favorite yourself");
//     }

//     await User.findByIdAndUpdate(req.user._id, {
//       $addToSet: { favouriteUsers: req.params.id }
//     });

//     res.redirect('/api/v1/user/users');
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Error adding favourite');
//   }
// });


user.post('/favourate/:id', requireAuth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).send('User not found');

    if (req.user._id.toString() === req.params.id) {
      return res.status(400).send("You can't favorite yourself");
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { favouriteUsers: req.params.id }
    });

    res.redirect('/api/v1/user/users?success=UserAddedToFavourites');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding favourite');
  }
});


user.post('/unfavourite/:id', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { favouriteUsers: req.params.id }
    });
    res.redirect('/api/v1/user/users?success=UserRemovedFromFavourites');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error removing favourite');
  }
});
































// @route   GET /api/v1/user/notifications
// @desc    Get all notifications for the current user
// @access  Private
// user.get("/notifications", requireAuth, async (req, res) => {
//   try {
//     // Get the current user's ID from the request (assuming you have auth middleware)
//     const userId = req.user._id;

//     // Fetch notifications from the database
//     const notifications = await Notification.find({ recipient: userId })
//       .sort({ createdAt: -1 }) // Sort by newest first
//       .populate({
//         path: 'senderDetails',
//         select: 'username profilePic isVerified' // Only get necessary fields
//       })
//       .lean(); // Convert to plain JavaScript object

//     // Render the notifications page with the data
//     // res.render("mobileres/notification", {
//     //   user: req.user, // Current user data
//     //   notifications: notifications.map(notif => ({
//     //     ...notif,
//     //     // Format dates if needed
//     //     createdAt: new Date(notif.createdAt).toISOString()
//     //   }))
//     // });
//     res.render("mobileres/notification.ejs")
//     // res.send("hye")

//   } catch (err) {
//     console.error('Error fetching notifications:', err);
//     res.status(500).render("notification", {
//       user: req.user,
//       error: "Failed to load notifications"
//     });
//   }
// });



// In your user router file (user.router.js)
user.get("/notifications", requireAuth,async (req, res) => {
  try {
    // Make sure you're getting the authenticated user
    const currentUser = req.user; // This should come from your auth middleware
    
    // Fetch notifications for the current user
    const notifications = await Notification.find({ recipient: currentUser._id })
      .sort({ createdAt: -1 })
      .populate('senderDetails', 'username profilePic isVerified')
      .lean();

    // Render the template with both user and notifications data
    res.render("mobileres/notification.ejs", { 
      user: currentUser,
      notifications: notifications
    });

  } catch (err) {
    console.error('Error loading notifications:', err);
    res.status(500).render("mobileres/notification.ejs", {
      error: "Failed to load notifications"
    });
  }
});

// @route   GET /api/v1/user/notifications-all
// @desc    Get all notifications for API (used by AJAX in notification.ejs)
// @access  Private
user.get("/notifications-all", async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'senderDetails',
        select: 'username profilePic isVerified'
      })
      .lean();

    res.json({
      success: true,
      notifications: notifications.map(notif => ({
        ...notif,
        createdAt: new Date(notif.createdAt).toISOString()
      }))
    });

  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({
      success: false,
      error: "Failed to load notifications"
    });
  }
});

// @route   POST /api/v1/user/notifications/:id/mark-viewed
// @desc    Mark a notification as read
// @access  Private
user.post("/notifications/:id/mark-viewed", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    // Verify the notification belongs to the current user
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: notificationId,
        recipient: userId 
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    res.json({
      success: true,
      notification
    });

  } catch (err) {
    console.error('Error marking notification as viewed:', err);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as viewed"
    });
  }
});

// @route   POST /api/v1/user/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
user.post("/notifications/mark-all-read", async (req, res) => {
  try {
    const userId = req.user._id;

    // Update all unread notifications for this user
    const result = await Notification.updateMany(
      { 
        recipient: userId,
        isRead: false 
      },
      { isRead: true }
    );

    res.json({
      success: true,
      updatedCount: result.modifiedCount
    });

  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read"
    });
  }
});







user.get("/search", requireAuth, (req, res) => {
  try {
    // Make sure you're getting the authenticated user from your auth middleware
    const currentUser = req.user;
    
    // Render the template with the user data
    res.render("mobileres/search", { 
      user: currentUser
    });

  } catch (err) {
    console.error('Error rendering search page:', err);
    res.status(500).render("mobileres/search", {
      error: "Failed to load search page"
    });
  }
});













