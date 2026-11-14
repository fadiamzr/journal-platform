import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-dashed border-rule p-8 md:p-12 text-center bg-paper-alt/40",
        className
      )}
    >
      {title && (
        <h3 className="text-base font-heading font-medium text-ink mb-1">
          {title}
        </h3>
      )}
      <p className="text-sm text-muted max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
