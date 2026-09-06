import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        body: "#334155",
        muted: "#64748B",
        sand: "#F8FAFC",
        sage: "#EEF3F0",
        line: "#E2E8F0",

        // Turquoise médical — couleur primaire (boutons, liens importants, éléments actifs)
        primary: {
          50: "#E6F7F7",
          100: "#CCEFEF",
          DEFAULT: "#0EA5A8",
          600: "#0B8689",
          700: "#096C6E",
        },
        // Alias "teal" conservé pour compatibilité — même famille que primary
        teal: {
          50: "#E6F7F7",
          100: "#CCEFEF",
          200: "#9FE0E1",
          500: "#14B8BB",
          600: "#0EA5A8",
          700: "#096C6E",
          900: "#053335",
        },
        // Bleu professionnel — navigation secondaire, liens
        blue: {
          50: "#EAF1FE",
          DEFAULT: "#2563EB",
          600: "#1D4ED8",
        },
        // Violet innovation — interopérabilité / automatisation / IA uniquement, avec parcimonie
        purple: {
          50: "#F1EBFC",
          DEFAULT: "#7C3AED",
          600: "#6D28D9",
        },
        ok: "#16A34A",
        warn: "#F59E0B",
        bad: "#DC2626",
        info: {
          50: "#EAF1FE",
          DEFAULT: "#3B82F6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.03), 0 4px 12px -4px rgba(15,23,42,0.06)",
        lift: "0 2px 6px rgba(15,23,42,0.05), 0 8px 20px -10px rgba(15,23,42,0.1)",
      },
      borderRadius: {
        card: "18px",
      },
      letterSpacing: {
        tightish: "-0.015em",
      },
    },
  },
  plugins: [],
};
export default config;
