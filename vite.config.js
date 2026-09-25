import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
        "pwa-icon.svg",
        "offline.html",
      ],
      manifest: {
        id: "/",
        name: "BizTrac - Mobile Business Management",
        short_name: "BizTrac",
        description: "Mobile-first business management and POS application for Ghanaian SMEs.",
        theme_color: "#027AEC",
        background_color: "#F4F8FF",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        dir: "ltr",
        categories: ["business", "finance", "shopping", "utilities"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
        shortcuts: [
          {
            name: "New Sale",
            short_name: "New Sale",
            description: "Open POS screen to record a new sale",
            url: "/?screen=sales",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Stock & Inventory",
            short_name: "Inventory",
            description: "View and update product stock",
            url: "/?screen=inventory",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Business Reports",
            short_name: "Reports",
            description: "Check analytics and business reports",
            url: "/?screen=reports",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallback: "/index.html",
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
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "image-assets-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
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
