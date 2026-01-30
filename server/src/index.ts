import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeRouter } from "./routes/analyze.js";
import { wikiRouter } from "./routes/wiki.js";

const DEFAULT_PORT = 3000;

const app = new Hono();

// Enable CORS for VS Code extension
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

// Analyze endpoint
app.route("/analyze", analyzeRouter);

// Wiki generation endpoint
app.route("/wiki", wikiRouter);

const port = Number.parseInt(process.env.DEEPSIGHT_PORT ?? String(DEFAULT_PORT), 10);
const serverPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;

serve({
  fetch: app.fetch,
  port: serverPort,
}, (info) => {
  console.log(`🚀 DeepSight server running on http://localhost:${info.port}`);
});
