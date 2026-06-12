import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/) || id.includes("scheduler")) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("class-variance-authority") || id.includes("tailwind-merge") || id.includes("clsx")) return "ui";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("framer-motion")) return "motion";
        },
      },
    },
  },
});
