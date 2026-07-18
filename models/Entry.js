const mongoose = require("mongoose");

const entryItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String },
    unit: { type: String },
    price: { type: Number },
    quantity: { type: Number, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    customFields: { type: Map, of: String, default: {} },
    entryItems: [entryItemSchema],
    totalValue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entry", entrySchema);
