import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] px-2 py-0.5 text-xs font-medium transition-colors border",
  {
    variants: {
      variant: {
        default: "border-rule bg-paper-alt text-ink",
        outline: "border-rule bg-transparent text-muted",
        success: "border-success/20 bg-success-bg text-success",
        warning: "border-warning/20 bg-warning-bg text-warning",
        danger: "border-danger/20 bg-danger-bg text-danger",
        accent: "border-accent/20 bg-accent-bg text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
