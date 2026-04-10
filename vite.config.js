import fs from "fs";
import { defineConfig } from "vite";

// Leer archivos de /src
const files = fs.readdirSync("./src");

const input = Object.fromEntries(
  files
    .filter((f) => f.endsWith(".js"))
    .map((f) => [f.replace(".js", ""), `./src/${f}`])
);

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  },

  build: {
    rollupOptions: {
      input,
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});