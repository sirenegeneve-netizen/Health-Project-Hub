import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12232E",
        sand: "#F7F4ED",
        sage: "#EEF3F0",
        teal: {
          50: "#EEF6F5",
          100: "#D7E9E7",
          200: "#B7D8D4",
          500: "#2C6E68",
          600: "#1F5450",
          700: "#123A37",
          900: "#0B2624",
        },
        clay: {
          50: "#FBEEE7",
          DEFAULT: "#C4623B",
          600: "#A94F2E",
        },
        blue: {
          50: "#EAF1FE",
          DEFAULT: "#2F6FED",
          600: "#2557C4",
        },
        purple: {
          50: "#F1EDFB",
          DEFAULT: "#7C5CE0",
          600: "#6547C2",
        },
        ok: "#2F7A4F",
        warn: "#B8791E",
        bad: "#C0392B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18,35,46,0.04), 0 8px 24px -12px rgba(18,35,46,0.12)",
        lift: "0 4px 10px rgba(18,35,46,0.06), 0 16px 32px -16px rgba(18,35,46,0.18)",
      },
      letterSpacing: {
        tightish: "-0.015em",
      },
    },
  },
  plugins: [],
};
export default config;
