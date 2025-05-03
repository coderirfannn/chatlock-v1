import express from "express";
import { progilePic, SetprogilePic, showChatPage } from "../../controllers/user.controller.js";
import { requireAuth } from "../../middleware/user.middleware.js";
import multer from "multer";

export const user = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });


user.get("/set/profile" ,requireAuth,progilePic)

user.post("/upload-profile",requireAuth ,upload.single("profilePic"), SetprogilePic)

user.get("/chating" ,requireAuth ,showChatPage)



