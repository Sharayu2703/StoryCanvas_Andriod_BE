import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  title: { type: String, trim: true, maxlength: 120, default: "Untitled story" },
  caption: { type: String, trim: true, maxlength: 500, default: "" },
  imageDataUrl: { type: String, required: true },
  stickerLabels: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

export default mongoose.model("Project", projectSchema);
