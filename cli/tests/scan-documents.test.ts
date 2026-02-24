import { afterEach, describe, expect, it } from "vitest";
import { scanDocuments } from "../src/run.js";
import { createWorkspace, writeWorkspaceFile } from "./helpers/workspace.js";

let cleanup: (() => Promise<void>) | undefined;

const setupWorkspace = async () => {
  const workspace = await createWorkspace();
  cleanup = workspace.cleanup;

  await writeWorkspaceFile(workspace.root, "docs/README.md", "# Readme");
  await writeWorkspaceFile(workspace.root, "docs/notes.txt", "note");
  await writeWorkspaceFile(workspace.root, "docs/diagram.png", "binary");
  await writeWorkspaceFile(workspace.root, "docs/guide/guide.docx", "docx");
  await writeWorkspaceFile(workspace.root, "docs/slides/deck.pptx", "pptx");
  await writeWorkspaceFile(workspace.root, "src/app.ts", "export const x = 1;");
  await writeWorkspaceFile(workspace.root, "reports/old.md", "skip");
  await writeWorkspaceFile(workspace.root, ".deepsight/cache.md", "skip");
  await writeWorkspaceFile(workspace.root, "node_modules/pkg/readme.md", "skip");

  return workspace.root;
};

afterEach(async () => {
  if (cleanup) {
    await cleanup();
    cleanup = undefined;
  }
});

describe("scanDocuments", () => {
  it("collects docs while skipping excluded directories", async () => {
    const root = await setupWorkspace();

    const docs = await scanDocuments(root);

    expect(docs).toEqual([
      "docs/guide/guide.docx",
      "docs/notes.txt",
      "docs/README.md",
      "docs/slides/deck.pptx",
    ]);
  });
});
