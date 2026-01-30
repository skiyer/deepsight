import { Hono } from "hono";
import { cors } from "hono/cors";
import { analyzeRouter } from "./routes/analyze.js";
import { wikiRouter } from "./routes/wiki.js";

export const createApp = () => {
  const app = new Hono();

  app.use(
    "/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
  );

  app.route("/analyze", analyzeRouter);
  app.route("/wiki", wikiRouter);

  return app;
};

export const app = createApp();
