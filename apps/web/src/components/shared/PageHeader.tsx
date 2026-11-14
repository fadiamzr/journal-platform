import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("pb-6 mb-8 border-b border-rule", className)}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-heading font-semibold text-ink tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[16px] text-muted leading-relaxed font-body">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
