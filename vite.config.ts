import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { beasties } from "vite-plugin-beasties";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));


export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? process.env.COMMIT_SHA?.slice(0, 7) ?? "dev"),
  },

  plugins: [
    react(),
    tailwindcss(),
    // Inlines above-the-fold CSS into index.html and async-loads the rest
    // (preload + media=print → onload swap). Runs at build time only.
    beasties({
      options: {
        preload: "swap",
        pruneSource: false,
        inlineFonts: true,
        logLevel: "silent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000,
    strictPort: false,
  },
  esbuild: {
    // Strip console.* and debugger from production bundles (keeps warn/error for ops visibility).
    drop: process.env.NODE_ENV === "production" ? ["debugger"] : [],
    pure: process.env.NODE_ENV === "production" ? ["console.log", "console.info", "console.debug"] : [],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React + Router travel together — always needed on first paint.
          if (
            id.includes("react-dom") ||
            id.match(/[\\/]react[\\/]/) ||
            id.includes("scheduler") ||
            id.includes("react-router")
          ) return "vendor-react";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (
            id.includes("@radix-ui") ||
            id.includes("lucide-react") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge") ||
            id.includes("clsx")
          ) return "vendor-ui";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("date-fns")) return "vendor-date";
        },
      },
    },
  },
});
