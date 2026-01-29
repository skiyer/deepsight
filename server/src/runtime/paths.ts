export const isWsl =
  process.platform === "linux" && process.env.WSL_DISTRO_NAME !== undefined;

/**
 * Convert Windows path to WSL path
 * e.g., "d:\\MyWorks\\project" -> "/mnt/d/MyWorks/project"
 */
export function toWslPath(windowsPath: string): string {
  if (/^[a-zA-Z]:/.test(windowsPath)) {
    const driveLetter = windowsPath[0].toLowerCase();
    const rest = windowsPath.slice(2).replace(/\\/g, "/");
    return `/mnt/${driveLetter}${rest}`;
  }
  return windowsPath.replace(/\\/g, "/");
}

export function resolveWorkspacePaths(paths: { cwd: string; file: string }): {
  cwd: string;
  file: string;
  converted: boolean;
} {
  if (!isWsl) {
    return { ...paths, converted: false };
  }

  return {
    cwd: toWslPath(paths.cwd),
    file: toWslPath(paths.file),
    converted: true,
  };
}
