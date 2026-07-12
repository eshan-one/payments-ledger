import mongoose from "mongoose";

// Backs atomic, human-readable sequence numbers (e.g. invoice ids). One
// document per sequence name, keyed by _id — $inc on it is a single atomic
// write, so concurrent callers can never be handed the same number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model("Counter", counterSchema);
