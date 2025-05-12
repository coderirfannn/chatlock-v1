import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.Model.js";
import Chat from "../models/chatModel.js";
import cloudinary from "../middleware/cloudnary.js";
import getDataUri from "../middleware/datauri.js";

import validator from 'validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';



export const registerSecurityMiddleware = [
  helmet(),
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many registration attempts, please try again later'
  })
];

const JWT_EXPIRES = "1d";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

export const registerShowPage = (req, res) => {
  res.render("auth/register");
};

// export const register = async (req, res) => {
//   const { username, email, password } = req.body;

//   try {
//     if (!username || !email || !password) {
//       return res.status(400).send("All fields are required");
//     }

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).send("User already exists");

//     const hashedPassword = await bcrypt.hash(password, 12);

//     const newUser = await User.create({
//       username,
//       email,
//       password: hashedPassword,
//     });

//     const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
//       expiresIn: JWT_EXPIRES,
//     });

//     res.cookie("token", token, COOKIE_OPTIONS);
//     res.redirect("/api/v1/user/set/profile");
//   } catch (error) {
//     console.error("Register Error:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };









export const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Invalid email address')
    .isLength({ max: 254 })
    .withMessage('Email too long'),
  
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character')
];

export const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).send("All fields are required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      isVerified: true // Directly set as verified
    });

    const token = jwt.sign(
      { 
        userId: newUser._id,
        role: 'user' // Regular user role immediately
      }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      redirectUrl: '/api/v1/user/users' // Redirect to dashboard directly
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};


















export const loginShowPage = (req, res) => {
  res.render("auth/login");
};

// export const login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await User.findOne({ email }).select("+password");

//     if (!user) return res.status(400).send("Invalid credentials");

//     if (user.blockExpires && user.blockExpires > Date.now()) {
//       return res.status(403).send("Account is temporarily blocked.");
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       user.loginAttempts += 1;

//       if (user.loginAttempts >= 5) {
//         user.blockExpires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
//         await user.save();
//         return res.status(403).send("Too many failed attempts. Try again later.");
//       }

//       await user.save();
//       return res.status(400).send(`Invalid credentials. Attempts left: ${5 - user.loginAttempts}`);
//     }

//     // Reset login attempts
//     user.loginAttempts = 0;
//     user.blockExpires = null;
//     user.isOnline = true;
//     await user.save();

//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
//       expiresIn: JWT_EXPIRES,
//     });

//     res.cookie("token", token, COOKIE_OPTIONS);
//     res.redirect("/api/v1/user/users");
//   } catch (error) {
//     console.error("Login Error:", error);
//     res.status(500).send("Internal Server Error");
//   }
// };


export const login = async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    const user = await User.findOne({ email }).select("+password +loginAttempts +blockExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if account is blocked
    if (user.blockExpires && user.blockExpires > Date.now()) {
      const timeLeft = Math.ceil((user.blockExpires - Date.now()) / (1000 * 60 * 60));
      return res.status(403).json({
        success: false,
        message: `Account temporarily blocked. Try again in ${timeLeft} hours.`,
        blockExpires: user.blockExpires
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.loginAttempts += 1;

      // Block account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.blockExpires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
        await user.save();
        
        return res.status(403).json({
          success: false,
          message: "Account temporarily blocked due to too many failed attempts. Try again later.",
          blockExpires: user.blockExpires
        });
      }

      await user.save();
      
      return res.status(400).json({
        success: false,
        message: `Invalid credentials. ${5 - user.loginAttempts} attempts remaining`,
        attemptsLeft: 5 - user.loginAttempts
      });
    }

    // Successful login - reset attempts and update status
    user.loginAttempts = 0;
    user.blockExpires = null;
    user.isOnline = true;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role || 'user' // Include user role if available
      }, 
      process.env.JWT_SECRET, 
      {
        expiresIn: process.env.JWT_EXPIRES || '1d',
        algorithm: 'HS256'
      }
    );

    // Set secure HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      redirectUrl: "/api/v1/user/users"
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again."
    });
  }
};


export const progilePic = async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.render("auth/image", { user });
};

export const SetprogilePic = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).send("Unauthorized");

    if (!req.file) return res.status(400).send("No file uploaded");

    const fileUri = getDataUri(req.file);
    const cloudUpload = await cloudinary.uploader.upload(fileUri);

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    user.profilePic = cloudUpload.secure_url;
    await user.save();

    res.redirect("/api/v1/user/users");
  } catch (error) {
    console.error("Set Profile Pic Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

export const showChatPage = async (req, res) => {
  const user = req.user;
  const allUsers = await User.find({ _id: { $ne: req.user._id } }).select("-password");
  res.render("message/chat", { user, allUsers });
};

export const saveChat = async (req, res) => {
  const { sender_id, receiver_id, message } = req.body;

  if (!sender_id || !receiver_id || !message) {
    return res.status(400).json({ success: false, msg: "All fields are required" });
  }

  try {
    const newChat = await Chat.create({ sender_id, receiver_id, message });
    res.status(200).json({ success: true, message: newChat.message });
  } catch (error) {
    console.error("Save Chat Error:", error);
    res.status(500).json({ success: false, msg: "Internal Server Error" });
  }
};

export const getChatHistory = async (req, res) => {
  const { user1, user2 } = req.params;

  if (!user1 || !user2) {
    return res.status(400).json({ success: false, msg: "User IDs required" });
  }

  try {
    const messages = await Chat.find({
      $or: [
        { sender_id: user1, receiver_id: user2 },
        { sender_id: user2, receiver_id: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Get Chat History Error:", error);
    res.status(500).json({ success: false, msg: "Internal Server Error" });
  }
};
