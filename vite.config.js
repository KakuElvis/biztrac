import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
});
