import "dotenv/config";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";

export const auth = betterAuth({
  database: mongodbAdapter(mongoose.connection),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user", // user, vendor, admin
      },
      status: {
        type: "string",
        defaultValue: "active", // active, fraud
      }
    }
  },
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
  ]
});
