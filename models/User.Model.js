import mongoose from "mongoose";
import validator from "validator";

// Constants
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_.]+$/,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Invalid email address"]
  },
  profilePic: {
    type: String,
    maxlength: 300,
    validate: {
      validator: (v) => validator.isURL(v || '', { protocols: ['http', 'https'], require_protocol: true }),
      message: "Invalid profile picture URL"
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    default: 'prefer-not-to-say'
  },
  bio: {
    type: String,
    maxlength: 500
  },
  password: {
    type: String,
    required: true,
    minlength: 8, // Stronger password recommendation
    select: false // Prevent password from being returned in queries by default
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  loginAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: MAX_LOGIN_ATTEMPTS
  },
  lastSeen: {
    type: Date,
    default: null
  },
  blockExpires: {
    type: Date,
    default: null
  },
  website: {
    type: String,
    validate: {
      validator: (v) => !v || validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }),
      message: "Invalid website URL"
    }
  },
  phone: {
    type: String,
    validate: {
      validator: (v) => !v || validator.isMobilePhone(v, 'any', { strictMode: true }),
      message: "Invalid phone number"
    }
  },
  pushSubscription: {
    endpoint: { type: String },
    keys: {
      p256dh: { type: String },
      auth: { type: String }
    }
  },
  favouriteUsers: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]
}, { timestamps: true });

// Indexes
UserSchema.index({ email: 1 }, { unique: true });

// Virtuals, methods, or statics can go here (e.g., for password hashing, checking block status, etc.)

const User = mongoose.model("User", UserSchema);
export default User;
