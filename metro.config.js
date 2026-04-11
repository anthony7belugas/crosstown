const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude the Cloud Functions directory from the React Native bundle.
// functions/index.js imports firebase-functions (Node-only) and must never
// be bundled by Metro.
const functionsDir = path.resolve(__dirname, "functions");
const escapeRegex = (str) => str.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
config.resolver.blockList = [
  new RegExp(`^${escapeRegex(functionsDir)}[\\/].*$`),
];

module.exports = config;
