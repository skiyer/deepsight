export function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const withStars = escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
  return new RegExp(`^${withStars}$`);
}

export function matchesPattern(normalizedPath: string, pattern: string): boolean {
  const regex = patternToRegex(pattern);
  if (regex.test(normalizedPath)) return true;
  const withLeadingSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  return regex.test(withLeadingSlash);
}

export function isExcludedPath(targetPath: string, excludePatterns: string[]): boolean {
  const normalized = normalizePath(targetPath);
  return excludePatterns.some((pattern) => matchesPattern(normalized, pattern));
}

export function isSensitivePath(targetPath: string, sensitivePaths: string[]): boolean {
  const normalized = normalizePath(targetPath);
  const base = normalized.split("/").pop() || normalized;
  return sensitivePaths.some(
    (pattern) => matchesPattern(normalized, pattern) || matchesPattern(base, pattern)
  );
}

export function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  if (!markdown.startsWith("---")) return { frontMatter: "", body: markdown };
  const lines = markdown.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return { frontMatter: "", body: markdown };
  return {
    frontMatter: lines.slice(1, end).join("\n").trim(),
    body: lines.slice(end + 1).join("\n").replace(/^\n+/, ""),
  };
}

export function extractConfidence(markdown: string): "low" | "medium" | "high" {
  const match = markdown.match(/confidence\s*[:：]\s*(low|medium|high)/i);
  if (match?.[1]) return match[1].toLowerCase() as "low" | "medium" | "high";
  return "medium";
}

export function extractBlindSpots(markdown: string): string[] | undefined {
  const match = markdown.match(/blindSpots?\s*[:：]\s*\[([^\]]*)\]/i);
  if (!match?.[1]) return undefined;
  const raw = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return raw.length ? raw : undefined;
}
