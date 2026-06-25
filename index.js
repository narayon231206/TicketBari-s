import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./lib/db.js";
import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import { User } from "./models/User.js";

// Routes
import ticketRoutes from "./routes/tickets.js";
import bookingRoutes from "./routes/bookings.js";
import userRoutes from "./routes/users.js";
import paymentRoutes from "./routes/payments.js";
import popularRoutes from "./routes/popularRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ticketbari-ouse4amx2-narayon231206s-projects.vercel.app",
        "https://ticketbari-aqzmbc1tq-narayon231206s-projects.vercel.app"
      ];
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BetterAuth Handler
app.all("/api/auth/*any", toNodeHandler(auth));

// Custom Protected API Routes
app.use("/api/tickets", ticketRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/popular-routes", popularRoutes);

// Root Endpoint
app.get("/", (req, res) => {
  res.send("TicketBari API Server is running...");
});

// Seed Function
import { PopularRoute } from "./models/PopularRoute.js";
import { Ticket } from "./models/Ticket.js";

const seedUsersAndRoutes = async () => {
  try {
    const adminEmail = "admin@ticketbari.com";
    const vendorEmail = "vendor@ticketbari.com";
    const userEmail = "user@ticketbari.com";

    const admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      console.log("Seeding Admin User...");
      try {
        await auth.api.signUpEmail({
          body: {
            name: "Admin User",
            email: adminEmail,
            password: "AdminPassword123!",
          },
        });
        await User.findOneAndUpdate({ email: adminEmail }, { role: "admin" });
        console.log("Admin seeded successfully.");
      } catch (e) {
        console.error("Failed to seed admin:", e.message);
      }
    }

    const vendor = await User.findOne({ email: vendorEmail });
    if (!vendor) {
      console.log("Seeding Vendor User...");
      try {
        await auth.api.signUpEmail({
          body: {
            name: "Vendor User",
            email: vendorEmail,
            password: "VendorPassword123!",
          },
        });
        await User.findOneAndUpdate({ email: vendorEmail }, { role: "vendor" });
        console.log("Vendor seeded successfully.");
      } catch (e) {
        console.error("Failed to seed vendor:", e.message);
      }
    }

    const testUser = await User.findOne({ email: userEmail });
    if (!testUser) {
      console.log("Seeding Test User...");
      try {
        await auth.api.signUpEmail({
          body: {
            name: "Test User",
            email: userEmail,
            password: "UserPassword123!",
          },
        });
        console.log("Test user seeded successfully.");
      } catch (e) {
        console.error("Failed to seed user:", e.message);
      }
    }
  } catch (error) {
    console.error("User seeding error:", error.message);
  }

  // Seed Popular Routes
  try {
    const routeCount = await PopularRoute.countDocuments();
    if (routeCount === 0) {
      console.log("Seeding Popular Routes...");
      const popularRoutesData = [
        { from: "Dhaka", to: "Cox's Bazar", type: "Bus & Flight", price: "৳৯০০+", image: "https://images.unsplash.com/photo-1596495578065-6e076b8df1d8?auto=format&fit=crop&q=80&w=400" },
        { from: "Dhaka", to: "Sylhet", type: "Train & Bus", price: "৳৪৫০+", image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&q=80&w=400" },
        { from: "Chittagong", to: "Dhaka", type: "Train & Bus", price: "৳৪৮০+", image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=400" },
        { from: "Dhaka", to: "Barisal", type: "Launch", price: "৳৩৫০+", image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=400" },
      ];
      await PopularRoute.insertMany(popularRoutesData);
      console.log("Popular routes seeded successfully.");
    }
  } catch (error) {
    console.error("Popular Routes seeding error:", error.message);
  }

  // Seed Tickets
  try {
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      console.log("Seeding Tickets...");
      const dummyTickets = [
        {
          title: "Green Line Express (A/C)",
          from: "Dhaka",
          to: "Chittagong",
          transportType: "Bus",
          price: 1200,
          quantity: 40,
          departureDateTime: new Date(Date.now() + 86400000 * 2), // 2 days from now
          perks: ["A/C", "WiFi", "Water"],
          image: "https://i.ibb.co.com/b50PTDvW/modern-white-tour-bus-transportation-vehicle-for-passenger-travel-and-sightseeing-photo.jpg",
          vendorName: "Vendor User",
          vendorEmail: "vendor@ticketbari.com",
          verificationStatus: "approved",
          isAdvertised: true,
        },
        {
          title: "Subarna Express",
          from: "Dhaka",
          to: "Chittagong",
          transportType: "Train",
          price: 850,
          quantity: 120,
          departureDateTime: new Date(Date.now() + 86400000 * 3), // 3 days from now
          perks: ["A/C Seat", "Food", "Washroom"],
          image: "https://i.ibb.co.com/Q7gt5D2j/Train-Journey.webp",
          vendorName: "Vendor User",
          vendorEmail: "vendor@ticketbari.com",
          verificationStatus: "approved",
          isAdvertised: true,
        },
        {
          title: "Sundarban 10",
          from: "Dhaka",
          to: "Barisal",
          transportType: "Launch",
          price: 1500,
          quantity: 50,
          departureDateTime: new Date(Date.now() + 86400000 * 1), // 1 day from now
          perks: ["A/C Cabin", "Restaurant", "Balcony"],
          image: "https://i.ibb.co.com/m5bfD3Rw/3-2.png",
          vendorName: "Vendor User",
          vendorEmail: "vendor@ticketbari.com",
          verificationStatus: "approved",
          isAdvertised: true,
        },
        {
          title: "Biman Bangladesh Airlines",
          from: "Dhaka",
          to: "Cox's Bazar",
          transportType: "Plane",
          price: 4500,
          quantity: 30,
          departureDateTime: new Date(Date.now() + 86400000 * 5), // 5 days from now
          perks: ["Baggage", "Snacks"],
          image: "https://i.ibb.co.com/rGDL3tF9/4.avif",
          vendorName: "Vendor User",
          vendorEmail: "vendor@ticketbari.com",
          verificationStatus: "approved",
          isAdvertised: false,
        }
      ];
      await Ticket.insertMany(dummyTickets);
      console.log("Tickets seeded successfully.");
    }
  } catch (error) {
    console.error("Tickets seeding error:", error.message);
  }
};

// Start Server after DB Connect
connectDB().then(async () => {
  await seedUsersAndRoutes();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
