require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const formConfigRoutes = require("./routes/formConfig");
const entryRoutes = require("./routes/entries");

const app = express();
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/sales_app";

// ---- Cached DB connection (critical for serverless) ----
let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}
app.set("trust proxy", 1);
async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // fail fast instead of hanging 30s
        maxPoolSize: 5,                  // keep small — serverless spins up many instances
        family: 4,                       // avoid IPv6/SRV resolution issues on some hosts
      })
      .then((m) => {
        console.log("✅ MongoDB connected");
        return m;
      })
      .catch((err) => {
        cached.promise = null; // allow retry on next request instead of caching a failure forever
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// ---- Middleware ----
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Ensure DB is connected before any route handles a request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    res.status(503).json({ error: "Database unavailable, try again shortly" });
  }
});

// Session (note: connect-mongo will also open its own connection — see note below)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ---- Routes ----
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/form-config", formConfigRoutes);
app.use("/api/entries", entryRoutes);

// Health check
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    mongodb: mongoose.connection.readyState, // 1 = connected
  });
});

// ---- Export for Vercel (no app.listen in production) ----
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});