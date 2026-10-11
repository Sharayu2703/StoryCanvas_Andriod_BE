import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import Project from "./models/Project.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Middleware
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "18mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "StoryCanvas API",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Save a project
app.post("/api/projects", async (req, res) => {
  try {
    const { title, caption, imageDataUrl, stickerLabels } = req.body || {};

    // Validate image
    if (
      typeof imageDataUrl !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,/.test(imageDataUrl)
    ) {
      return res.status(400).json({
        error: "imageDataUrl must be a PNG, JPEG, or WebP data URL.",
      });
    }

    // Limit image size
    if (imageDataUrl.length > 16 * 1024 * 1024) {
      return res.status(413).json({
        error: "Image is too large. Please export a smaller image.",
      });
    }

    // Require MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database is unavailable. Please try again later.",
      });
    }

    const project = await Project.create({
      title: typeof title === "string" ? title.slice(0, 120) : "Untitled story",

      caption: typeof caption === "string" ? caption.slice(0, 500) : "",

      imageDataUrl,

      stickerLabels: Array.isArray(stickerLabels)
        ? stickerLabels.filter((item) => typeof item === "string").slice(0, 30)
        : [],
    });

    return res.status(201).json({
      id: project._id,
      title: project.title,
      createdAt: project.createdAt,
    });
  } catch (error) {
    console.error("Create project failed:", error);

    return res.status(500).json({
      error: "Could not save project.",
    });
  }
});

// Get all projects
app.get("/api/projects", async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database is unavailable.",
      });
    }

    const projects = await Project.find({}, { imageDataUrl: 0 })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json(projects);
  } catch (error) {
    console.error("Load projects failed:", error);

    return res.status(500).json({
      error: "Could not load projects.",
    });
  }
});

// Get one project by ID
app.get("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid project ID.",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Database is unavailable.",
      });
    }

    const project = await Project.findById(id).lean();

    if (!project) {
      return res.status(404).json({
        error: "Project not found.",
      });
    }

    return res.json(project);
  } catch (error) {
    console.error("Load project failed:", error);

    return res.status(500).json({
      error: "Could not load project.",
    });
  }
});

// Handle unknown API routes
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "API route not found.",
  });
});

// Global error handler
app.use((error, _req, res, _next) => {
  console.error("Unexpected server error:", error);

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request is too large.",
    });
  }

  return res.status(500).json({
    error: "Unexpected server error.",
  });
});

// Start server
async function start() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log("MongoDB connected");
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
    }
  } else {
    console.warn("MONGODB_URI is not set. Project saving requires MongoDB.");
  }

  app.listen(PORT, () => {
    console.log(`StoryCanvas API listening on port ${PORT}`);
  });
}

start();
