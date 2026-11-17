import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          alt: "rgb(var(--paper-alt-rgb) / <alpha-value>)",
        },
        rule: "rgb(var(--rule-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-text-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          hover: "rgb(var(--accent-hover-rgb) / <alpha-value>)",
          bg: "var(--accent-bg)",
        },
        gold: {
          DEFAULT: "rgb(var(--gold-rgb) / <alpha-value>)",
          muted: "rgb(var(--gold-rgb) / 0.2)",
        },
        success: {
          DEFAULT: "rgb(var(--success-rgb) / <alpha-value>)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning-rgb) / <alpha-value>)",
          bg: "var(--warning-bg)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)",
          bg: "var(--danger-bg)",
        },
        /* shadcn semantic tokens mapped to CSS vars */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "rgb(var(--accent-rgb) / <alpha-value>)",
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
        heading: ["var(--font-heading)", "Georgia", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        warm: "0 4px 14px -2px rgba(31, 27, 22, 0.08)",
        "warm-lg": "0 8px 24px -4px rgba(31, 27, 22, 0.12)",
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
        DEFAULT: "rgb(var(--accent-rgb))",
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
