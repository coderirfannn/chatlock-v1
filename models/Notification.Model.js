import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },
        chat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: true
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true
        },
        notificationType: {
            type: String,
            enum: ["message", "system", "friend_request"],
            default: "message"
        },
        metaData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: {
            virtuals: true
        }
    }
);

// Indexes for faster queries
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual populate for sender details
notificationSchema.virtual('senderDetails', {
    ref: 'User',
    localField: 'sender',
    foreignField: '_id',
    justOne: true,
    options: { select: 'username profilePic email isOnline' }
});

// Virtual populate for chat details
notificationSchema.virtual('chatDetails', {
    ref: 'Chat',
    localField: 'chat',
    foreignField: '_id',
    justOne: true
});

// Middleware to populate sender and chat details when fetching
notificationSchema.pre(/^find/, function (next) {
    this.populate({
        path: 'senderDetails',
        select: 'username profilePic email isOnline'
    }).populate({
        path: 'chatDetails',
        select: 'participants'
    });
    next();
});

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function (notificationIds) {
    return this.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { isRead: true } }
    );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ recipient: userId, isRead: false });
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;