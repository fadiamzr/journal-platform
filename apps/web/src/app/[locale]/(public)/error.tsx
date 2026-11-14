"use client";

import React, { useEffect } from "react";
import { ErrorState } from "@/components/shared/ErrorState";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Public Route Error:", error);
  }, [error]);

  return (
    <div className="py-12">
      <ErrorState
        title="Unable to load content"
        message={error.message || "An unexpected error occurred while loading this page."}
        onRetry={() => reset()}
      />
    </div>
  );
}
