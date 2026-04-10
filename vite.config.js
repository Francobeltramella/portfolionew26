import fs from "fs";

const files = fs.readdirSync("./src");

const input = Object.fromEntries(
  files
    .filter(f => f.endsWith(".js"))
    .map(f => [f.replace(".js", ""), `./src/${f}`])
);

export default {
  build: {
    rollupOptions: {
      input,
      output: {
        entryFileNames: "[name].js"
      }
    }
  }
};