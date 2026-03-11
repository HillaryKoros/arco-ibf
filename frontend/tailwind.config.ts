import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        icpac: {
          green: "#00833e",
          gold: "#c49a2a",
          dark: "#1a1a2e",
          blue: "#16213e",
        },
        hazard: {
          drought: "#e3181a",
          flood: "#3273dc",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
