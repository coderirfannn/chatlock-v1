import bcrypt from "bcryptjs";
import User from "../models/User.Model.js"; // Make sure the path is correct
import jwt from "jsonwebtoken";
import cloudinary from "../middleware/cloudnary.js";
import getDataUri from "../middleware/datauri.js";

export const registerShowPage = (req, res) => {
    res.render("auth/register");
};

export const register = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // 1. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send("User already exists");
        }

        // 2. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create new user
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
        });

        // 4. Generate JWT token (optional but common)
        const token = jwt.sign(
            { userId: newUser._id }, // assuming user has a role
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // 5. Respond or redirect
        res.cookie("token", token, { httpOnly: true });
        res.redirect("/api/v1/user/set/profile"); // redirect to a protected route

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).send("Server error");
    }
};



export const loginShowPage = (req, res) => {
    res.render("auth/login"); // Your EJS login page
};
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        // User not found
        if (!user) {
            return res.status(400).send("Invalid credentials");
        }

        // Check block status
        if (user.blockExpires && user.blockExpires > new Date()) {
            return res.status(403).send("Account is blocked. Try again later.");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            user.loginAttempts += 1;

            if (user.loginAttempts >= 9) {
                user.blockExpires = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Block for 2 days
                await user.save();
                return res.status(403).send("Too many attempts. Account blocked for 2 days.");
            }

            await user.save();
            return res.status(400).send(`Invalid credentials. Attempts left: ${9 - user.loginAttempts}`);
        }

        // Successful login: reset counters
        user.loginAttempts = 0;
        user.blockExpires = null;
        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        res.cookie("token", token, { httpOnly: true });
        res.redirect("/api/v1/user/chating");

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Server error");
    }
};



export const progilePic = async (req, res) => {

    const userId = req.user._id;;
    const user =  await User.findById(userId).select('-password');
 
    res.render("auth/image" ,{user})
  
}

export const SetprogilePic = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).send("Unauthorized");
    
        const profilePic = req.file;
        console.log("Received file:", profilePic); // Debug line
    
        let cloudResponse;
        if (profilePic) {
          const fileUri = getDataUri(profilePic);
          cloudResponse = await cloudinary.uploader.upload(fileUri);
        }
    
        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");
    
        if (cloudResponse?.secure_url) {
          user.profilePic = cloudResponse.secure_url;
        }
        await user.save();
        res.redirect("/api/v1/user/chating");
      } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).send("Server error");
      }

}





export const showChatPage = async (req, res) => {
    const user = req.user;
    const userid = req.user._id;
  
    const allUser = await User.find({ _id: { $ne: userid } }); // excludes current user
  
    res.render("message/chat", { user, allUser });
  };
  





/// displaying all user into the dashboard

// export const allUsers = async (req,res)=>{
  
// }