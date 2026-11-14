import React from "react";
import type { StatusEvent } from "@/lib/domain/types";
import { formatLocalizedDate } from "@/lib/utils";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

interface TimelineProps {
  events: StatusEvent[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  const locale = useLocale();

  if (!events || events.length === 0) return null;

  return (
    <div className={cn("relative ps-6 space-y-6 border-s border-rule", className)}>
      {events.map((evt, idx) => (
        <div key={evt.at + idx} className="relative">
          <div
            className="absolute -start-[31px] top-1.5 h-2.5 w-2.5 rounded-full border border-paper bg-ink"
            aria-hidden="true"
          />
          <div className="flex flex-col text-sm">
            <span className="font-medium text-ink capitalize">
              {evt.to.replace("_", " ")}
            </span>
            <span className="text-xs text-muted">
              {formatLocalizedDate(evt.at, locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
