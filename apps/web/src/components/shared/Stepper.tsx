import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepItem {
  id: string | number;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  className?: string;
}

export function Stepper({ steps, currentStepIndex, className }: StepperProps) {
  return (
    <nav aria-label="Progress steps" className={cn("w-full py-4", className)}>
      <ol className="flex items-center w-full list-none p-0 m-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                isLast ? "w-auto" : "w-full"
              )}
            >
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium border transition-colors",
                    isCompleted
                      ? "border-success bg-success-bg text-success"
                      : isCurrent
                      ? "border-accent bg-accent text-paper font-semibold"
                      : "border-rule bg-paper text-muted"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs md:text-sm whitespace-nowrap",
                    isCurrent
                      ? "font-semibold text-ink"
                      : isCompleted
                      ? "text-ink"
                      : "text-muted"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "h-[1px] w-full mx-2 md:mx-4 transition-colors",
                    isCompleted ? "bg-success/50" : "bg-rule"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
