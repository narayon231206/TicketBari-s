import express from "express";
import { Ticket } from "../models/Ticket.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Create a ticket (Vendor only)
router.post("/", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const { title, from, to, transportType, price, quantity, departureDateTime, perks, image } = req.body;

    const newTicket = new Ticket({
      title,
      from,
      to,
      transportType,
      price: Number(price),
      quantity: Number(quantity),
      departureDateTime: new Date(departureDateTime),
      perks: Array.isArray(perks) ? perks : [],
      image,
      vendorName: req.user.name || "Vendor",
      vendorEmail: req.user.email,
      verificationStatus: "pending"
    });

    await newTicket.save();
    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get approved tickets (Public with search, filter, sort, pagination)
router.get("/", async (req, res) => {
  try {
    const { from, to, transportType, sort, page = 1, limit = 9 } = req.query;

    const query = { verificationStatus: "approved" };

    // Location mapping for Bengali to English support and common misspellings
    const bnToEnMap = {
      "ঢাকা": "Dhaka",
      "dhaka": "Dhaka",
      "চট্টগ্রাম": "Chittagong",
      "chittagong": "Chittagong",
      "ctg": "Chittagong",
      "বরিশাল": "Barisal",
      "barisal": "Barisal",
      "রাজশাহী": "Rajshahi",
      "rajshahi": "Rajshahi",
      "কক্সবাজার": "Cox's Bazar",
      "কক্স বাজার": "Cox's Bazar",
      "coxs bazar": "Cox's Bazar",
      "cox bazar": "Cox's Bazar",
      "cox's bazar": "Cox's Bazar",
      "সিলেট": "Sylhet",
      "sylhet": "Sylhet",
      "খুলনা": "Khulna",
      "khulna": "Khulna",
      "রংপুর": "Rangpur",
      "rangpur": "Rangpur",
      "ময়মনসিংহ": "Mymensingh",
      "কুমিল্লা": "Comilla",
      "গাজীপুর": "Gazipur",
      "নারায়ণগঞ্জ": "Narayanganj"
    };

    const getRegexPattern = (loc) => {
      if (!loc) return null;
      const normalized = loc.trim().toLowerCase();
      let safeLoc = loc.trim();
      
      // If it's a known name or misspelling, translate it to standard name
      if (bnToEnMap[normalized]) {
        safeLoc = bnToEnMap[normalized];
      }
      
      // Replace special characters to make search robust
      safeLoc = safeLoc.replace(/['\-]/g, ".*");
      return new RegExp(safeLoc, "i");
    };

    // Search by From/To
    const fromPattern = getRegexPattern(from);
    if (fromPattern) query.from = fromPattern;
    
    const toPattern = getRegexPattern(to);
    if (toPattern) query.to = toPattern;

    // Filter by Transport Type
    if (transportType && transportType !== "All") {
      query.transportType = transportType;
    }

    // Check if vendor is fraud
    // To do this dynamically, we can query active vendors later, but let's do a simple check.
    // For now, let's keep it simple. If we need to hide tickets from fraud vendors,
    // we can filter them by fetching non-fraud users first or we can handle it in the admin controller by updating tickets.
    // In Manage Users, marking a vendor as fraud hides all their tickets. So we can update all their tickets to verificationStatus = 'rejected' or isHidden = true.
    // Let's do that when admin marks a vendor as fraud!

    // Sorting by price
    let sortQuery = {};
    if (sort === "lowToHigh") {
      sortQuery.price = 1;
    } else if (sort === "highToLow") {
      sortQuery.price = -1;
    } else {
      sortQuery.createdAt = -1; // Default: latest
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const totalTickets = await Ticket.countDocuments(query);
    const tickets = await Ticket.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      tickets,
      totalTickets,
      totalPages: Math.ceil(totalTickets / Number(limit)),
      currentPage: Number(page)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get advertised tickets (Public)
router.get("/advertised", async (req, res) => {
  try {
    const tickets = await Ticket.find({ verificationStatus: "approved", isAdvertised: true }).limit(6);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get latest tickets (Public)
router.get("/latest", async (req, res) => {
  try {
    // Latest 6-8 tickets
    const tickets = await Ticket.find({ verificationStatus: "approved" })
      .sort({ createdAt: -1 })
      .limit(8);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get tickets added by the logged-in vendor (Vendor only)
router.get("/vendor", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const tickets = await Ticket.find({ vendorEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get all tickets (Admin only)
router.get("/admin/all", protect, restrictTo("admin"), async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get ticket details
router.get("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Update ticket (Vendor only, disabled if verificationStatus is 'rejected')
router.put("/:id", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your ticket." });
    }

    if (ticket.verificationStatus === "rejected") {
      return res.status(400).json({ error: "Cannot update a rejected ticket." });
    }

    const { title, from, to, transportType, price, quantity, departureDateTime, perks, image } = req.body;

    ticket.title = title || ticket.title;
    ticket.from = from || ticket.from;
    ticket.to = to || ticket.to;
    ticket.transportType = transportType || ticket.transportType;
    ticket.price = price !== undefined ? Number(price) : ticket.price;
    ticket.quantity = quantity !== undefined ? Number(quantity) : ticket.quantity;
    ticket.departureDateTime = departureDateTime ? new Date(departureDateTime) : ticket.departureDateTime;
    ticket.perks = perks || ticket.perks;
    ticket.image = image || ticket.image;

    // Reset status to pending when updated
    ticket.verificationStatus = "pending";

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Delete ticket (Vendor only, disabled if verificationStatus is 'rejected')
router.delete("/:id", protect, restrictTo("vendor"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.vendorEmail !== req.user.email) {
      return res.status(403).json({ error: "Access denied. Not your ticket." });
    }

    if (ticket.verificationStatus === "rejected") {
      return res.status(400).json({ error: "Cannot delete a rejected ticket." });
    }

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Approve ticket (Admin only)
router.put("/:id/approve", protect, restrictTo("admin"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    ticket.verificationStatus = "approved";
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Reject ticket (Admin only)
router.put("/:id/reject", protect, restrictTo("admin"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    ticket.verificationStatus = "rejected";
    ticket.isAdvertised = false; // Cannot advertise rejected
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Toggle advertisement (Admin only, max 6)
router.put("/:id/advertise", protect, restrictTo("admin"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.verificationStatus !== "approved") {
      return res.status(400).json({ error: "Only approved tickets can be advertised." });
    }

    if (!ticket.isAdvertised) {
      // Trying to advertise it, check if already 6 advertised
      const advertisedCount = await Ticket.countDocuments({ verificationStatus: "approved", isAdvertised: true });
      if (advertisedCount >= 6) {
        return res.status(400).json({ error: "Cannot advertise more than 6 tickets at a time." });
      }
    }

    ticket.isAdvertised = !ticket.isAdvertised;
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
