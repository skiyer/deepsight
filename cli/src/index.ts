import { runCli } from "./run.js";

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "ANTHROPIC_AUTH_TOKEN is not set") {
    console.error(message);
  } else {
    console.error(`[fatal] ${message}`);
  }
  process.exit(1);
});
