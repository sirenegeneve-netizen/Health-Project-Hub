import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12232E",
        slate: {
          950: "#0C1A22",
        },
        teal: {
          50: "#EEF6F5",
          100: "#D7E9E7",
          500: "#2C6E68",
          600: "#215650",
          700: "#193F3B",
        },
        clay: "#C4623B",
        sand: "#F6F3EC",
        ok: "#2F7A4F",
        warn: "#B8791E",
        bad: "#B8402F",
      },
      fontFamily: {
        sans: ["Source Sans 3", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
