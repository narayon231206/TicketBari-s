import express from "express";
import { User } from "../models/User.js";
import { Ticket } from "../models/Ticket.js";
import { protect, restrictTo, generateToken } from "../middleware/authMiddleware.js";
import { auth } from "../lib/auth.js";

const router = express.Router();

// 1. Generate custom JWT token from BetterAuth session (Public or verification endpoint)
router.post("/custom-jwt", async (req, res) => {
  try {
    // BetterAuth session verification
    const session = await auth.api.getSession({
      headers: req.headers
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: "Invalid BetterAuth session" });
    }

    // Find the user in our database to get their roles & status
    const dbUser = await User.findOne({ email: session.user.email });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found in database" });
    }

    if (dbUser.status === "fraud") {
      return res.status(403).json({ error: "Access denied. Your account is marked as fraud." });
    }

    // Generate JWT
    const jwtToken = generateToken(dbUser);
    res.json({ token: jwtToken, user: dbUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get profile information of the logged-in user
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get all users (Admin only)
router.get("/", protect, restrictTo("admin"), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update role of user to admin or vendor (Admin only)
router.put("/:id/role", protect, restrictTo("admin"), async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "vendor", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = role;
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Mark vendor as fraud (Admin only)
router.put("/:id/fraud", protect, restrictTo("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "vendor") {
      return res.status(400).json({ error: "Only vendors can be marked as fraud." });
    }

    user.status = "fraud";
    await user.save();

    // Hide all of the vendor's tickets by setting verificationStatus to 'rejected'
    await Ticket.updateMany(
      { vendorEmail: user.email },
      { $set: { verificationStatus: "rejected", isAdvertised: false } }
    );

    res.json({ message: "Vendor marked as fraud. All tickets hidden.", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
