require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/sales_app";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const existing = await User.findOne({ employeeId: "admin" });
  if (existing) {
    console.log("⚠️  Admin user already exists. Skipping seed.");
    process.exit(0);
  }

  const passwordHash = await User.hashPassword("admin123");
  await User.create({ name: "Administrator", employeeId: "admin", passwordHash, role: "admin" });
  console.log("✅ Admin user created — ID: admin / Password: admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
