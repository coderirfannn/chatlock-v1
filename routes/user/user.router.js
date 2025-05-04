import express from "express";
import { getChatHistory, progilePic, saveChat, SetprogilePic, showChatPage } from "../../controllers/user.controller.js";
import { requireAuth } from "../../middleware/user.middleware.js";
import multer from "multer";
import User from "../../models/User.Model.js";

export const user = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });


user.get("/set/profile" ,requireAuth,progilePic)

user.post("/upload-profile",requireAuth ,upload.single("profilePic"), SetprogilePic)

user.get("/chating" ,requireAuth ,showChatPage)

user.post("/save-chat", requireAuth,saveChat)



    
    user.get('/users',requireAuth, async (req, res) => {
        const currentUser = req.user;

        const userid = req.user._id;
        const allUser = await User.find({ _id: { $ne: userid} }); // avoid showing self

      
        res.render('message/users', {
          allUser,
          user: currentUser, // ✅ add this
        });
      });
      
  


  user.get('/chat/:id', requireAuth , async (req, res) => {
    const user = await User.findById(req.params.id);
    const currentUser = req.user;
    // res.send(user)
    // console.log(currentUser);
    
    res.render('message/chatt', { user, currentUser });
  });


  user.get("/chat/:user1/:user2" , requireAuth ,getChatHistory);


