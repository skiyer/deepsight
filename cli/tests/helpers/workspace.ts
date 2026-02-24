import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function createWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "deepsight-cli-"));
  return {
    root,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

export async function writeWorkspaceFile(root: string, relPath: string, content: string) {
  const fullPath = path.join(root, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  return fullPath;
}
