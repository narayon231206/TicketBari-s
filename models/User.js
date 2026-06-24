import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    role: { type: String, enum: ["user", "vendor", "admin"], default: "user" },
    status: { type: String, enum: ["active", "fraud"], default: "active" },
  },
  { 
    timestamps: true,
    collection: "user" // Force mongoose to use the collection created by BetterAuth
  }
);

export const User = mongoose.model("User", userSchema);
