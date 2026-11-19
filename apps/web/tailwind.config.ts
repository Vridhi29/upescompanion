import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: c("paper"),
        panel: c("panel"),
        ink: c("ink"),
        muted: c("muted"),
        rule: c("rule"),
        accent: c("accent"),
        safe: c("safe"),
        warn: c("warn"),
        danger: c("danger"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
