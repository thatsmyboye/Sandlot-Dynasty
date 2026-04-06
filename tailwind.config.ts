import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        diamond: {
          50: "#f0f4ff",
          100: "#dce6ff",
          200: "#b9cdff",
          300: "#86a8ff",
          400: "#4d78ff",
          500: "#1a47ff",
          600: "#0028f5",
          700: "#001de2",
          800: "#0019b7",
          900: "#001990",
        },
        field: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
