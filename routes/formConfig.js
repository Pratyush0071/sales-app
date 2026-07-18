const express = require("express");
const FormField = require("../models/FormField");
const Item = require("../models/Item");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();

// GET /api/form-config
router.get("/", requireAuth, async (req, res) => {
  try {
    const [fields, items] = await Promise.all([
      FormField.find().sort({ sortOrder: 1 }),
      Item.find().sort({ createdAt: 1 }),
    ]);
    res.json({
      fields: fields.map((f) => ({ id: f._id, label: f.label, fieldType: f.fieldType, required: f.required, sortOrder: f.sortOrder })),
      items: items.map((i) => ({ id: i._id, name: i.name, unit: i.unit, price: i.price, createdAt: i.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/form-config/fields
router.post("/fields", requireAdmin, async (req, res) => {
  try {
    const { label, fieldType, required, sortOrder } = req.body;
    if (!label) return res.status(400).json({ error: "label is required" });
    const field = await FormField.create({ label, fieldType: fieldType || "text", required: !!required, sortOrder: sortOrder || 0 });
    res.status(201).json({ id: field._id, label: field.label, fieldType: field.fieldType, required: field.required, sortOrder: field.sortOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/form-config/fields/:id
router.put("/fields/:id", requireAdmin, async (req, res) => {
  try {
    const field = await FormField.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!field) return res.status(404).json({ error: "Field not found" });
    res.json({ id: field._id, label: field.label, fieldType: field.fieldType, required: field.required, sortOrder: field.sortOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/form-config/fields/:id
router.delete("/fields/:id", requireAdmin, async (req, res) => {
  try {
    await FormField.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/form-config/items
router.post("/items", requireAdmin, async (req, res) => {
  try {
    const { name, unit, price } = req.body;
    if (!name || !unit || price === undefined) return res.status(400).json({ error: "name, unit and price required" });
    const item = await Item.create({ name, unit, price });
    res.status(201).json({ id: item._id, name: item.name, unit: item.unit, price: item.price, createdAt: item.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/form-config/items/:id
router.put("/items/:id", requireAdmin, async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ id: item._id, name: item.name, unit: item.unit, price: item.price, createdAt: item.createdAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/form-config/items/:id
router.delete("/items/:id", requireAdmin, async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
