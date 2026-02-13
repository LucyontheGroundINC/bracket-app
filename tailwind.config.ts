import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx,js,jsx,mdx}", "./components/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "bn-bg": "#121417",
        "bn-primary": "#E6C770",
        "bn-muted": "#C7CCD4",
      },
    },
  },
};

export default config;
