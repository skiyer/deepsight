import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const DEFAULT_PORT = 3000;

const port = Number.parseInt(process.env.DEEPSIGHT_PORT ?? String(DEFAULT_PORT), 10);
const serverPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;

serve(
  {
    fetch: app.fetch,
    port: serverPort,
  },
  (info) => {
    console.log(`🚀 DeepSight server running on http://localhost:${info.port}`);
  }
);
