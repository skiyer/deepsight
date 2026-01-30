import path from "node:path";

export function getToolDisplayInfo(toolName: string, input: unknown): string {
  switch (toolName) {
    case "Read": {
      const filePath = (input as { file_path?: string } | null | undefined)?.file_path;
      return filePath ? path.basename(String(filePath)) : "";
    }
    case "Glob": {
      const pattern = (input as { pattern?: string } | null | undefined)?.pattern;
      return pattern ? `${pattern}` : "";
    }
    default: {
      let summary = "";
      if (input === undefined || input === null) {
        summary = "";
      } else if (typeof input === "string") {
        summary = input;
      } else if (typeof input === "object") {
        summary = JSON.stringify(input);
      } else {
        summary = String(input);
      }
      return summary || "—";
    }
  }
}
