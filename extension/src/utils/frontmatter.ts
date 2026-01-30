export function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  if (!markdown.startsWith("---")) return { frontMatter: "", body: markdown };
  const lines = markdown.split("\n");
  if (lines.length < 3) return { frontMatter: "", body: markdown };
  if (lines[0].trim() !== "---") return { frontMatter: "", body: markdown };
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontMatter: "", body: markdown };
  const frontMatter = lines.slice(1, end).join("\n").trim();
  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "");
  return { frontMatter, body };
}

export function parseFrontMatter(frontMatter: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of frontMatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function buildFrontMatter(params: {
  title: string;
  now: string;
  existingFrontMatter: string;
  confidence: "low" | "medium" | "high";
  blindSpots?: string[];
  scope: { include: string[]; exclude: string[] };
  serverUrl: string;
}): string {
  const existing = parseFrontMatter(params.existingFrontMatter);
  const created = existing.created || params.now;
  const model = existing.model || "";
  const blindSpots =
    params.blindSpots && params.blindSpots.length
      ? `[${params.blindSpots.map((value) => `"${value}"`).join(", ")}]`
      : existing.blindSpots || "[]";
  const scopeBlock = `scope:\n  include: [${params.scope.include
    .map((value) => `"${value}"`)
    .join(", ")}]\n  exclude: [${params.scope.exclude
    .map((value) => `"${value}"`)
    .join(", ")}]`;

  return [
    "---",
    `title: ${params.title}`,
    `created: ${created}`,
    `updated: ${params.now}`,
    `generatedBy: deepsight`,
    `generatedAt: ${params.now}`,
    `serverUrl: ${params.serverUrl}`,
    model ? `model: ${model}` : "model: ",
    scopeBlock,
    `confidence: ${params.confidence}`,
    `blindSpots: ${blindSpots}`,
    "---",
  ].join("\n");
}
