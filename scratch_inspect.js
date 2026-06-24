import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./models/User.js";
import { Ticket } from "./models/Ticket.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const users = await User.find({});
  console.log("USERS:");
  console.log(JSON.stringify(users, null, 2));

  const tickets = await Ticket.find({});
  console.log("TICKETS:");
  console.log(JSON.stringify(tickets, null, 2));

  process.exit(0);
}

run().catch(console.error);
