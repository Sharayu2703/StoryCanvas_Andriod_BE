import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import Project from "./models/Project.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(morgan("dev"));
app.use(express.json({ limit: "18mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "StoryCanvas API",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.post("/api/projects", async (req, res) => {
  try {
    const { title, caption, imageDataUrl, stickerLabels } = req.body || {};
    if (typeof imageDataUrl !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageDataUrl)) {
      return res.status(400).json({ error: "imageDataUrl must be a PNG, JPEG, or WebP data URL." });
    }
    if (imageDataUrl.length > 16 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large. Please export a smaller image." });
    }
    const project = await Project.create({
      title: typeof title === "string" ? title.slice(0, 120) : "Untitled story",
      caption: typeof caption === "string" ? caption.slice(0, 500) : "",
      imageDataUrl,
      stickerLabels: Array.isArray(stickerLabels) ? stickerLabels.filter(x => typeof x === "string").slice(0, 30) : []
    });
    res.status(201).json({ id: project._id, title: project.title, createdAt: project.createdAt });
  } catch (error) {
    console.error("Create project failed:", error);
    res.status(500).json({ error: "Could not save project." });
  }
});

app.get("/api/projects", async (_req, res) => {
  try {
    const projects = await Project.find({}, { imageDataUrl: 0 }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Could not load projects." });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid project ID." });
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: "Project not found." });
    res.json(project);
  } catch {
    res.status(500).json({ error: "Could not load project." });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

async function start() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log("MongoDB connected");
    } catch (err) {
      console.error("MongoDB connection failed:", err.message);
      console.error("API will start, but project saving requires a working MongoDB connection.");
    }
  } else {
    console.warn("MONGODB_URI is not set; project saving will not work until configured.");
  }
  app.listen(PORT, () => console.log(`StoryCanvas API listening on http://localhost:${PORT}`));
}

start();
