/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#027AEC",
        secondary: "#022864",
        success: "#10B236",
        warning: "#F5A623",
        ink: "#022864",
        palm: "#027AEC",
        palmDeep: "#022864",
        gold: "#F5A623",
        clay: "#B46B00",
        skyglass: "#EAF4FF",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(2, 122, 236, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
