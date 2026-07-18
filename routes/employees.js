const express = require("express");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

// GET /api/employees
router.get("/", requireAdmin, async (req, res) => {
  try {
    const employees = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(employees.map((e) => ({ id: e._id, name: e.name, employeeId: e.employeeId, role: e.role, createdAt: e.createdAt })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, employeeId, password, role } = req.body;
    if (!name || !employeeId || !password)
      return res.status(400).json({ error: "name, employeeId and password required" });

    const existing = await User.findOne({ employeeId });
    if (existing) return res.status(400).json({ error: "Employee ID already exists" });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, employeeId, passwordHash, role: role || "employee" });
    res.status(201).json({ id: user._id, name: user.name, employeeId: user.employeeId, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { name, employeeId, password, role } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (employeeId) updates.employeeId = employeeId;
    if (role) updates.role = role;
    if (password) updates.passwordHash = await User.hashPassword(password);

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Employee not found" });
    res.json({ id: user._id, name: user.name, employeeId: user.employeeId, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
