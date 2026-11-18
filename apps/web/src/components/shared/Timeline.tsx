import React from "react";
import type { StatusEvent } from "@/lib/domain/types";
import { formatLocalizedDate } from "@/lib/utils";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

export interface TimelineEventItem {
  id?: string;
  label?: string;
  from?: string;
  to?: string;
  at?: string;
  timestamp?: string;
  status?: "completed" | "current" | "upcoming";
  note?: string;
}

interface TimelineProps {
  events: (StatusEvent | TimelineEventItem)[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  const locale = useLocale();

  if (!events || events.length === 0) return null;

  return (
    <div className={cn("relative ps-6 space-y-5 border-s border-rule", className)}>
      {events.map((rawEvt, idx) => {
        const evt = rawEvt as TimelineEventItem;
        const key = evt.id || evt.at || evt.timestamp || String(idx);
        const label = evt.label || (evt.to ? evt.to.replace("_", " ") : "Update");
        const dateString = evt.at || evt.timestamp;
        const itemStatus = evt.status || "completed";

        return (
          <div key={key} className="relative">
            <div
              className={cn(
                "absolute -start-[31px] top-1 h-2.5 w-2.5 rounded-full border border-paper transition-colors",
                itemStatus === "completed"
                  ? "bg-success"
                  : itemStatus === "current"
                  ? "bg-accent ring-2 ring-accent/30"
                  : "bg-paper border-rule"
              )}
              aria-hidden="true"
            />
            <div className="flex flex-col text-xs">
              <span
                className={cn(
                  "font-medium capitalize",
                  itemStatus === "upcoming" ? "text-muted" : "text-ink font-semibold"
                )}
              >
                {label}
              </span>
              {dateString && (
                <span className="text-[11px] text-muted">
                  {formatLocalizedDate(dateString, locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
