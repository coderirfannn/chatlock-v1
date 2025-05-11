import mongoose from "mongoose";

export const chatSchema = new mongoose.Schema({
    sender_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    receiver_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    message: {
        type: String,
        required: true
    },
    seen: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
