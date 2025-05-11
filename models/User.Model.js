import mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    profilePic: {
        type: String,

    },
    gender: {
        type: String,
        enum: ["Male", "Female"]
    },
    bio: {
        type: String,
    },
    password: {
        type: String,
        required: true
    },
    isOnline: {
        type: String,
        default: "0"
    }, loginAttempts: {
        type: Number,
        default: 0,
    },
    lastSeen: {
        type: Date,
        default: null
    },
    blockExpires: {
        type: Date,
        default: null,
    },
    pushSubscription: {
        endpoint: { type: String },
        keys: {
            p256dh: { type: String },
            auth: { type: String }
        }
    },favouriteUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]

}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
export default User;
