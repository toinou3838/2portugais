import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4efe7",
        ink: "#163229",
        bronze: "#b9773f",
        terracotta: "#c86d4f",
        moss: "#5d7a67",
        mist: "#e8dfd1",
      },
      boxShadow: {
        card: "0 24px 60px rgba(22, 50, 41, 0.12)",
        soft: "0 18px 40px rgba(22, 50, 41, 0.08)",
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top, rgba(255,255,255,0.7), transparent 45%), radial-gradient(circle at 20% 20%, rgba(185, 119, 63, 0.12), transparent 30%), radial-gradient(circle at 80% 0%, rgba(93, 122, 103, 0.18), transparent 26%)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
      animation: {
        "float-in": "floatIn 0.7s ease-out both",
      },
      keyframes: {
        floatIn: {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;

