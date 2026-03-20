const fs = require("node:fs");
const path = require("node:path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce(function(accumulator, line) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");

      accumulator[key] = value;
      return accumulator;
    }, {});
}

function getRuntimeEnv() {
  const projectRoot = process.cwd();
  const localEnv = parseEnvFile(path.join(projectRoot, ".env.local"));
  const defaultEnv = parseEnvFile(path.join(projectRoot, ".env"));

  return {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || localEnv.GOOGLE_MAPS_API_KEY || defaultEnv.GOOGLE_MAPS_API_KEY,
    kmlUrl: process.env.KML_URL || localEnv.KML_URL || defaultEnv.KML_URL
  };
}

module.exports = function handler(request, response) {
  const runtimeEnv = getRuntimeEnv();
  const googleMapsApiKey = runtimeEnv.googleMapsApiKey;
  const kmlUrl = runtimeEnv.kmlUrl;

  if (!googleMapsApiKey || !kmlUrl) {
    response.status(500).json({
      error: "Missing required environment variables.",
      required: ["GOOGLE_MAPS_API_KEY", "KML_URL"]
    });
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.status(200).json({
    googleMapsApiKey,
    kmlUrl
  });
};