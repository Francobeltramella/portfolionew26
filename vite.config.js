import fs from "fs";
import { defineConfig } from "vite";

// leer todos los archivos de src
const files = fs.readdirSync("./src");

const input = Object.fromEntries(
  files
    .filter((f) => f.endsWith(".js"))
    .map((f) => [f.replace(".js", ""), `./src/${f}`])
);

export default defineConfig({
  // 🔥 esto es solo para desarrollo (podés dejarlo o sacarlo)
  server: {
    host: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
    hmr: {
      protocol: "wss",
      host: "portfolionew26.netlify.app",
      clientPort: 443,
    },
  },

  // 🔥 esto es lo importante para Netlify / build
  build: {
    rollupOptions: {
      input,
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});