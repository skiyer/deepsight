export interface ConfigLike {
  get<T>(section: string, defaultValue: T): T;
}

export const DEFAULT_WIKI_INCLUDE = ["server", "extension"];

export const DEFAULT_WIKI_EXCLUDE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
];

export const DEFAULT_SENSITIVE_PATHS = [
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "**/credentials*.json",
];

export const getServerUrl = (config: ConfigLike, defaultPort = 3000): string => {
  const port = config.get<number>("serverPort", defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid server port: ${port}`);
  }
  return `http://localhost:${port}`;
};

export const getWikiScope = (
  config: ConfigLike,
  include: string[] = DEFAULT_WIKI_INCLUDE
): { include: string[]; exclude: string[] } => {
  const exclude = config.get<string[]>("wiki.excludePatterns", DEFAULT_WIKI_EXCLUDE);
  return { include, exclude };
};

export const getSensitivePaths = (config: ConfigLike): string[] =>
  config.get<string[]>("wiki.sensitivePaths", DEFAULT_SENSITIVE_PATHS);

export const getWikiLimits = (config: ConfigLike): { maxFilesRead: number; maxBytesRead: number } => {
  const maxFilesRead = config.get<number>("wiki.maxFilesRead", 400);
  const maxBytesRead = config.get<number>("wiki.maxBytesRead", 2 * 1024 * 1024);
  return { maxFilesRead, maxBytesRead };
};
