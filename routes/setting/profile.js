import express from "express";
import { getChatHistory, progilePic, saveChat, SetprogilePic, showChatPage } from "../../controllers/user.controller.js";
import { requireAuth } from "../../middleware/user.middleware.js";
import multer from "multer";
import User from "../../models/User.Model.js";
import Notification from "../../models/Notification.Model.js";
import Chat from "../../models/chatModel.js";


export const profile_router = express.Router();

profile_router.get("/feed",(req,res)=>{
    res.render("pages/home")
})



profile_router.get("/profile", requireAuth, async (req, res) => {
    const user = req.user;
    res.render("user/profile", { user })
})


profile_router.post("/profile/edit", requireAuth, async (req, res) => {
    try {
        const userId = req.user._id;  // safer
        const { name, username, email, bio, gender, profilePic, website ,phone } = req.body;

        const validGenders = ['male', 'female', 'other', 'prefer-not-to-say'];
        if (req.body.gender && !validGenders.includes(req.body.gender)) {
            return res.status(400).json({ message: "Invalid gender value" });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, {
            name: name,  // mapping
            username,
            email,
            bio,
            gender,
            profilePic,
            website,
            phone
        }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser
        });
    } catch (error) {
        console.error("Edit Profile Error:", error);
        return res.status(500).json({ message: "Internal Server Error." });
    }
});



