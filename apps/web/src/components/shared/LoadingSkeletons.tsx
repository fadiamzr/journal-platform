import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ArticleListSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="py-6 border-b border-rule space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ArticleDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-reading">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-5 w-1/2" />
      <div className="border-t border-b border-rule py-4 my-6">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
