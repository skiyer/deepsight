import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeRouter } from "./routes/analyze.js";

const app = new Hono();

// Enable CORS for VS Code extension
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Analyze endpoint
app.route("/analyze", analyzeRouter);

const port = Number(process.env.DEEPSIGHT_PORT) || 3000;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 DeepSight server running on http://localhost:${info.port}`);
});
