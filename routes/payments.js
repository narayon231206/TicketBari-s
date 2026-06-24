import express from "express";
import { Booking } from "../models/Booking.js";
import { Ticket } from "../models/Ticket.js";
import { Transaction } from "../models/Transaction.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock_secret_key");

// 1. Confirm payment (called by client after redirect with session_id)
router.post("/confirm", protect, restrictTo("user"), async (req, res) => {
  try {
    const { sessionId, bookingId } = req.body;

    if (!sessionId || !bookingId) {
      return res.status(400).json({ error: "Session ID and Booking ID are required." });
    }

    // Check if transaction was already processed
    const existingTx = await Transaction.findOne({ transactionId: sessionId });
    if (existingTx) {
      return res.json({ message: "Payment already processed.", bookingStatus: "paid" });
    }

    // Retrieve Stripe Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment was not successful on Stripe." });
    }

    // Process Booking
    const booking = await Booking.findById(bookingId).populate("ticket");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (booking.status === "paid") {
      return res.json({ message: "Booking already paid.", booking });
    }

    const ticket = await Ticket.findById(booking.ticket._id);
    if (!ticket) {
      return res.status(404).json({ error: "Associated ticket not found." });
    }

    // Verify stock availability
    if (ticket.quantity < booking.quantity) {
      return res.status(400).json({ error: "Not enough ticket stock left." });
    }

    // Deduct quantity
    ticket.quantity -= booking.quantity;
    await ticket.save();

    // Update booking status
    booking.status = "paid";
    await booking.save();

    // Create transaction log
    const tx = new Transaction({
      transactionId: sessionId,
      amount: booking.totalPrice,
      ticketTitle: booking.ticketTitle,
      userEmail: booking.userEmail,
      paymentDate: new Date(),
    });
    await tx.save();

    res.json({ message: "Payment confirmed successfully.", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get transaction history (User sees their own, Admin sees all)
router.get("/transactions", protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== "admin") {
      query.userEmail = req.user.email;
    }

    const transactions = await Transaction.find(query).sort({ paymentDate: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Vendor revenue data (Total tickets added, total tickets sold, total revenue)
router.get("/revenue-overview", protect, restrictTo("vendor"), async (req, res) => {
  try {
    // Get all tickets added by vendor
    const tickets = await Ticket.find({ vendorEmail: req.user.email });
    const totalTicketsAdded = tickets.length;

    // Get all paid bookings for vendor's tickets
    const ticketIds = tickets.map((t) => t._id);
    const paidBookings = await Booking.find({
      ticket: { $in: ticketIds },
      status: "paid",
    });

    let totalTicketsSold = 0;
    let totalRevenue = 0;

    paidBookings.forEach((b) => {
      totalTicketsSold += b.quantity;
      totalRevenue += b.totalPrice;
    });

    // Provide some monthly chart data for visualization (optional challenge helper)
    // Group sales by month
    const salesByTicket = tickets.map((t) => {
      const soldBookings = paidBookings.filter((b) => b.ticket.toString() === t._id.toString());
      const qtySold = soldBookings.reduce((sum, b) => sum + b.quantity, 0);
      const rev = soldBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      return {
        title: t.title,
        quantitySold: qtySold,
        revenue: rev,
      };
    });

    res.json({
      totalTicketsAdded,
      totalTicketsSold,
      totalRevenue,
      salesByTicket,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
