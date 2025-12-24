import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { logWarn } from "./logger.js";

/**
 * Gets the package version from package.json
 * @returns The package version string
 */
export function getPackageVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packagePath = join(__dirname, "../../package.json");
  
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version;
  } catch (error) {
    logWarn("Failed to read package version:", error);
    return "0.0.0"; // Fallback version
  }
} 
