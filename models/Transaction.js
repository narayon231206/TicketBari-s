import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    ticketTitle: { type: String, required: true },
    userEmail: { type: String, required: true },
    paymentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
