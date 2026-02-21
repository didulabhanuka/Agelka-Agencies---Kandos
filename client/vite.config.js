import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  esbuild: {
    loader: "jsx",
    include: [/\.js$/, /\.jsx$/],
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
