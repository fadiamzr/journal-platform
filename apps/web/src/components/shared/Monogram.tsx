import React from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

interface MonogramProps {
  className?: string;
  size?: number | "sm" | "md" | "lg";
}

export function Monogram({ className, size = 32 }: MonogramProps) {
  const letter = brand.logo.monogram?.letter || "J";

  const numSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 24
      : size === "md"
      ? 36
      : 48;

  return (
    <svg
      width={numSize}
      height={numSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-accent select-none", className)}
      aria-hidden="true"
    >
      {/* Outer circle */}
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1" />
      {/* Inner hairline circle */}
      <circle cx="16" cy="16" r="13" stroke="var(--gold, #B08D3C)" strokeWidth="0.5" strokeOpacity="0.8" />
      {/* Upper hairline */}
      <line x1="8" y1="8" x2="24" y2="8" stroke="var(--gold, #B08D3C)" strokeWidth="0.5" strokeOpacity="0.7" />
      {/* Lower hairline */}
      <line x1="8" y1="24" x2="24" y2="24" stroke="var(--gold, #B08D3C)" strokeWidth="0.5" strokeOpacity="0.7" />
      {/* Monogram Initial */}
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fontFamily="var(--font-source-serif), Georgia, serif"
        fontSize="14"
        fontWeight="bold"
        fill="currentColor"
      >
        {letter}
      </text>
    </svg>
  );
}
