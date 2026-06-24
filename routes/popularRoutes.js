import express from "express";
import { PopularRoute } from "../models/PopularRoute.js";

const router = express.Router();

// Get all popular routes
router.get("/", async (req, res) => {
  try {
    const routes = await PopularRoute.find({});
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
