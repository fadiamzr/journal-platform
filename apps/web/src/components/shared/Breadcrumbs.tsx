import React from "react";
import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs text-muted mb-4", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.label + index} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-ink hover:underline transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-ink font-medium" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}

              {!isLast && (
                <ChevronRight className="h-3.5 w-3.5 text-rule rtl:rotate-180" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
