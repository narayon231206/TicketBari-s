import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    transportType: {
      type: String,
      required: true,
      enum: ["Bus", "Train", "Launch", "Plane"]
    },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    departureDateTime: { type: Date, required: true },
    perks: [{ type: String }],
    image: { type: String, required: true },
    vendorName: { type: String, required: true },
    vendorEmail: { type: String, required: true },
    verificationStatus: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    isAdvertised: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Ticket = mongoose.model("Ticket", ticketSchema);
