import express from "express";
import { Booking } from "../models/Booking.js";
import { Ticket } from "../models/Ticket.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";
import Stripe from "stripe";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock_secret_key");

// 1. Create a booking (User only)
router.post("/", protect, restrictTo("user"), async (req, res) => {
  try {
    const { ticketId, quantity } = req.body;
    const requestedQty = Number(quantity);

    if (requestedQty <= 0) {
      return res.status(400).json({ error: "Booking quantity must be greater than 0" });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Check departure time
    if (new Date(ticket.departureDateTime) <= new Date()) {
      return res.status(400).json({ error: "Departure date and time have already passed." });
    }

    // Check if quantity is 0
    if (ticket.quantity <= 0) {
      return res.status(400).json({ error: "No tickets left (Quantity is 0)." });
    }

    // Check quantity availability
    if (requestedQty > ticket.quantity) {
      return res.status(400).json({ error: `Booking quantity can't be greater than available Ticket Quantity (${ticket.quantity})` });
    }

    const totalPrice = ticket.price * requestedQty;

    const booking = new Booking({
      ticket: ticket._id,
      ticketTitle: ticket.title,
      ticketImage: ticket.image,
      from: ticket.from,
      to: ticket.to,
      departureDateTime: ticket.departureDateTime,
      userEmail: req.user.email,
      userName: req.user.name || "User",
      quantity: requestedQty,
      totalPrice,
      status: "pending"
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Cancel booking (Optional requirement: only before vendor accepts)
router.post("/cancel/:id", protect, restrictTo("user"), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your booking." });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ error: "Can only cancel bookings with pending status." });
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get my bookings (User only)
router.get("/my-bookings", protect, restrictTo("user"), async (req, res) => {
  try {
    const bookings = await Booking.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get requested bookings (Vendor only)
router.get("/requested", protect, restrictTo("vendor"), async (req, res) => {
  try {
    // Fetch all tickets owned by this vendor
    const vendorTickets = await Ticket.find({ vendorEmail: req.user.email }).select("_id");
    const ticketIds = vendorTickets.map(t => t._id);

    // Find bookings for these tickets
    const bookings = await Booking.find({ ticket: { $in: ticketIds } }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Vendor Accept Booking (Vendor only)
router.put("/:id/accept", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ticket");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.ticket.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your ticket's booking." });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ error: "Booking is not in pending status." });
    }

    booking.status = "accepted";
    await booking.save();
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Vendor Reject Booking (Vendor only)
router.put("/:id/reject", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ticket");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.ticket.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your ticket's booking." });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ error: "Booking is not in pending status." });
    }

    booking.status = "rejected";
    await booking.save();
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Create Stripe Checkout Session for a booking
router.post("/:id/checkout-session", protect, restrictTo("user"), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("ticket");
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.userEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your booking." });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({ error: "Only accepted bookings can be paid." });
    }

    // Check if departure date and time have already passed
    if (new Date(booking.departureDateTime) <= new Date()) {
      return res.status(400).json({ error: "Users cannot make payment if the departure date and time have already passed." });
    }

    // Create stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.ticketTitle,
              description: `Route: ${booking.from} to ${booking.to} | Departure: ${new Date(booking.departureDateTime).toLocaleString()}`,
              images: [booking.ticketImage],
            },
            unit_amount: Math.round(booking.totalPrice * 100 / booking.quantity), // unit price in cents
          },
          quantity: booking.quantity,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/dashboard?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/dashboard?payment_failed=true`,
      metadata: {
        bookingId: booking._id.toString(),
        userEmail: booking.userEmail,
      }
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
