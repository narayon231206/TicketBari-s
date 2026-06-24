import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true },
    ticketTitle: { type: String, required: true },
    ticketImage: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    departureDateTime: { type: Date, required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "accepted", "rejected", "paid"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);
