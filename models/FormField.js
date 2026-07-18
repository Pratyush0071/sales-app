const mongoose = require("mongoose");

const formFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    fieldType: { type: String, enum: ["text", "number", "select"], default: "text" },
    required: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormField", formFieldSchema);
