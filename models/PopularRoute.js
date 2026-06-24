import mongoose from "mongoose";

const popularRouteSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  type: { type: String, required: true },
  price: { type: String, required: true },
  image: { type: String, required: true },
}, { timestamps: true });

export const PopularRoute = mongoose.model("PopularRoute", popularRouteSchema);
