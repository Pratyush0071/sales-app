const express = require("express");
const mongoose = require("mongoose");
const Entry = require("../models/Entry");
const Item = require("../models/Item");
const User = require("../models/User");
const FormField = require("../models/FormField");
const ExcelJS = require("exceljs");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();

// GET /api/entries/summary  (admin)
router.get("/summary", requireAdmin, async (req, res) => {
  try {
    const [totalAgg, todayAgg, empCount, topItems] = await Promise.all([
      Entry.aggregate([{ $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalValue" } } }]),
      Entry.aggregate([
        { $match: { date: new Date().toISOString().slice(0, 10) } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalValue" } } },
      ]),
      User.countDocuments({ role: "employee" }),
      Entry.aggregate([
        { $unwind: "$entryItems" },
        { $group: { _id: "$entryItems.itemName", totalQty: { $sum: "$entryItems.quantity" }, totalValue: { $sum: "$entryItems.value" } } },
        { $sort: { totalValue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      totalEntries: totalAgg[0]?.count || 0,
      totalValue: totalAgg[0]?.total || 0,
      todayEntries: todayAgg[0]?.count || 0,
      todayValue: todayAgg[0]?.total || 0,
      employeeCount: empCount,
      topItems: topItems.map((t) => ({ itemName: t._id, totalQty: t.totalQty, totalValue: t.totalValue })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entries/download  (Excel)
router.get("/download", requireAuth, async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const isAdmin = req.session.role === "admin";

    const filter = {};
    if (!isAdmin) filter.userId = new mongoose.Types.ObjectId(req.session.userId);
    if (employeeId) filter.userId = new mongoose.Types.ObjectId(employeeId);
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    const entries = await Entry.find(filter)
      .populate("userId", "name employeeId")
      .sort({ date: -1 });

    const [allItems, allFields] = await Promise.all([
      Item.find().sort({ createdAt: 1 }),
      FormField.find().sort({ sortOrder: 1 }),
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Entries");

    const headers = ["#", "Date", "Employee ID", "Employee Name"];
    allFields.forEach((f) => headers.push(f.label));
    allItems.forEach((item) => {
      headers.push(`${item.name} (${item.unit}) Qty`);
      headers.push(`${item.name} Value`);
    });
    headers.push("Total Value");

    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

    entries.forEach((entry, idx) => {
      const cf = Object.fromEntries(entry.customFields || new Map());
      const itemMap = new Map(entry.entryItems.map((ei) => [ei.itemId.toString(), ei]));
      const row = [idx + 1, entry.date, entry.userId?.employeeId || "", entry.userId?.name || ""];
      allFields.forEach((f) => row.push(cf[f.label] || ""));
      allItems.forEach((item) => {
        const ei = itemMap.get(item._id.toString());
        row.push(ei ? ei.quantity : 0);
        row.push(ei ? ei.value : 0);
      });
      row.push(entry.totalValue);
      sheet.addRow(row);
    });

    sheet.columns.forEach((col) => { col.width = 16; });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="entries-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entries
router.get("/", requireAuth, async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const isAdmin = req.session.role === "admin";

    const filter = {};
    if (!isAdmin) filter.userId = new mongoose.Types.ObjectId(req.session.userId);
    if (employeeId) filter.userId = new mongoose.Types.ObjectId(employeeId);
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    const entries = await Entry.find(filter)
      .populate("userId", "name employeeId")
      .sort({ date: -1 });

    res.json(
      entries.map((e) => ({
        id: e._id,
        userId: e.userId?._id,
        employeeName: e.userId?.name,
        employeeIdCode: e.userId?.employeeId,
        date: e.date,
        customFields: Object.fromEntries(e.customFields || new Map()),
        entryItems: e.entryItems,
        totalValue: e.totalValue,
        createdAt: e.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entries
router.post("/", requireAuth, async (req, res) => {
  try {
    const { date, customFields, items } = req.body;
    if (!date || !items || items.length === 0)
      return res.status(400).json({ error: "date and items are required" });

    const itemIds = items.map((i) => i.itemId);
    const dbItems = await Item.find({ _id: { $in: itemIds } });
    const itemPriceMap = new Map(dbItems.map((i) => [i._id.toString(), i]));

    let totalValue = 0;
    const entryItems = items.map((i) => {
      const dbItem = itemPriceMap.get(i.itemId);
      const value = (dbItem?.price || 0) * i.quantity;
      totalValue += value;
      return {
        itemId: i.itemId,
        itemName: dbItem?.name,
        unit: dbItem?.unit,
        price: dbItem?.price,
        quantity: i.quantity,
        value,
      };
    });

    const entry = await Entry.create({
      userId: req.session.userId,
      date,
      customFields: customFields || {},
      entryItems,
      totalValue,
    });

    const populated = await entry.populate("userId", "name employeeId");
    res.status(201).json({
      id: populated._id,
      userId: populated.userId?._id,
      employeeName: populated.userId?.name,
      employeeIdCode: populated.userId?.employeeId,
      date: populated.date,
      customFields: Object.fromEntries(populated.customFields || new Map()),
      entryItems: populated.entryItems,
      totalValue: populated.totalValue,
      createdAt: populated.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
