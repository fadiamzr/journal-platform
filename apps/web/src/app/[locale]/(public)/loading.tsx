import React from "react";
import { ArticleListSkeleton } from "@/components/shared/LoadingSkeletons";

export default function Loading() {
  return (
    <div className="py-8">
      <ArticleListSkeleton />
    </div>
  );
}
