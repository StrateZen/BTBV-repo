import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnvFile(filePath = path.resolve(process.cwd(), ".env")) {
  if (!existsSync(filePath)) return false;

  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) continue;

    const rawValue = line.slice(separatorIndex + 1).trim();
    process.env[key] = parseEnvValue(rawValue);
  }

  return true;
}

export function loadDefaultEnvFiles(
  filePaths = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), ".env.btbvapp")]
) {
  let loaded = false;
  for (const filePath of filePaths) {
    loaded = loadEnvFile(filePath) || loaded;
  }
  return loaded;
}

function parseEnvValue(rawValue) {
  if (!rawValue) return "";

  const isQuoted =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"));

  const trimmed = isQuoted ? rawValue.slice(1, -1) : rawValue;

  return trimmed
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}
