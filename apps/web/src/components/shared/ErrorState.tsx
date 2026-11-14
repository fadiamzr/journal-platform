"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  const t = useTranslations("common");

  return (
    <div
      role="alert"
      className={cn(
        "rounded-[3px] border border-danger/30 bg-danger-bg/40 p-6 md:p-8 text-center max-w-lg mx-auto my-8",
        className
      )}
    >
      <AlertCircle className="h-6 w-6 text-danger mx-auto mb-3" />
      <h3 className="text-base font-heading font-semibold text-danger mb-1">
        {title || t("errorTitle")}
      </h3>
      <p className="text-sm text-ink/80 mb-4 leading-relaxed">
        {message || t("errorMessage")}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-danger/40 text-danger hover:bg-danger-bg"
        >
          <RotateCcw className="h-3.5 w-3.5 me-1.5" />
          <span>{t("retry")}</span>
        </Button>
      )}
    </div>
  );
}
