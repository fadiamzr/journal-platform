import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: {
          DEFAULT: "#FFFFFF",
          alt: "#F7F6F2",
        },
        rule: "#D9D7D0",
        muted: "#5B5B57",
        accent: {
          DEFAULT: "#1B2A4A",
          bg: "#E4E8EF",
        },
        success: {
          DEFAULT: "#2F5D3A",
          bg: "#E8F0EA",
        },
        warning: {
          DEFAULT: "#8A5A00",
          bg: "#FFF3D6",
        },
        danger: {
          DEFAULT: "#8B1E2D",
          bg: "#F5E1E4",
        },
        /* shadcn semantic tokens mapped to CSS vars */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        "muted-ui": {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        "accent-ui": {
          DEFAULT: "hsl(var(--accent-ui))",
          foreground: "hsl(var(--accent-ui-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        lg: "4px",
        md: "3px",
        sm: "2px",
      },
      maxWidth: {
        content: "1120px",
        reading: "680px",
      },
      fontSize: {
        reading: ["17px", { lineHeight: "1.7" }],
        ui: ["15px", { lineHeight: "1.5" }],
      },
      ringColor: {
        DEFAULT: "#1B2A4A",
      },
    },
  },
  plugins: [],
};

export default config;
