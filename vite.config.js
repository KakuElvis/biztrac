import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-icon.svg",
        "offline.html",
      ],
      manifest: {
        name: "BizTrac - Mobile Business Management",
        short_name: "BizTrac",
        description: "Mobile-first business management and POS application for Ghanaian SMEs.",
        theme_color: "#027AEC",
        background_color: "#F4F8FF",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["business", "finance", "shopping", "utilities"],
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const seg = id.split("node_modules/").pop();
          const parts = seg.split("/");
          const pkg = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];

          if (pkg === "react" || pkg === "react-dom") return "vendor_react";
          if (pkg.startsWith("@supabase")) return "vendor_supabase";
          if (pkg === "recharts") return "vendor_recharts";
          if (["html2pdf.js", "html2canvas", "jspdf"].includes(pkg)) return "vendor_html2pdf";
          if (pkg === "lucide-react") return "vendor_icons";

          // Default: make a vendor chunk per package to avoid overlaps
          return `vendor_${pkg.replaceAll("/", "_").replaceAll("@", "_")}`;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
  },
});
