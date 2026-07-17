import mongoose from "mongoose";

// Backs atomic, human-readable sequence numbers (e.g. invoice ids).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model("Counter", counterSchema);
