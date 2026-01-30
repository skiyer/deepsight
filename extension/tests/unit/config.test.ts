import { describe, expect, it } from "vitest";
import {
  DEFAULT_SENSITIVE_PATHS,
  DEFAULT_WIKI_EXCLUDE,
  DEFAULT_WIKI_INCLUDE,
  getSensitivePaths,
  getServerUrl,
  getWikiLimits,
  getWikiScope,
} from "../../src/utils/config";

type ConfigValues = Record<string, unknown>;

const makeConfig = (values: ConfigValues) => ({
  get: <T,>(key: string, defaultValue: T) =>
    (key in values ? (values[key] as T) : defaultValue),
});

describe("config utils", () => {
  it("builds server url from port", () => {
    const config = makeConfig({ serverPort: 8080 });
    expect(getServerUrl(config)).toBe("http://localhost:8080");
  });

  it("throws on invalid port", () => {
    const config = makeConfig({ serverPort: 0 });
    expect(() => getServerUrl(config)).toThrow("Invalid server port: 0");
  });

  it("uses default include/exclude for wiki scope", () => {
    const config = makeConfig({});
    const scope = getWikiScope(config);
    expect(scope.include).toEqual(DEFAULT_WIKI_INCLUDE);
    expect(scope.exclude).toEqual(DEFAULT_WIKI_EXCLUDE);
  });

  it("uses configured exclude patterns", () => {
    const config = makeConfig({ "wiki.excludePatterns": ["**/tmp/**"] });
    const scope = getWikiScope(config);
    expect(scope.exclude).toEqual(["**/tmp/**"]);
  });

  it("reads sensitive paths and limits", () => {
    const config = makeConfig({});
    expect(getSensitivePaths(config)).toEqual(DEFAULT_SENSITIVE_PATHS);
    expect(getWikiLimits(config)).toEqual({
      maxFilesRead: 400,
      maxBytesRead: 2 * 1024 * 1024,
    });
  });
});
