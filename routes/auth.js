const express = require("express");
const User = require("../models/User");
const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password)
      return res.status(400).json({ error: "Employee ID and password required" });

    const user = await User.findOne({ employeeId });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = user._id.toString();
    req.session.role = user.role;

    res.json({ id: user._id, name: user.name, employeeId: user.employeeId, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  if (!req.session || !req.session.userId)
    return res.status(401).json({ error: "Not authenticated" });
  try {
    const user = await User.findById(req.session.userId).select("-passwordHash");
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ id: user._id, name: user.name, employeeId: user.employeeId, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
