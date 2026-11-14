import React from "react";
import type { Author } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

interface AuthorListProps {
  authors: Author[];
  showAffiliations?: boolean;
  className?: string;
}

export function AuthorList({
  authors,
  showAffiliations = true,
  className,
}: AuthorListProps) {
  if (!authors || authors.length === 0) return null;

  // Collect unique affiliations to assign 1-based index superscripts
  const affiliationMap = new Map<string, number>();
  authors.forEach((author) => {
    author.affiliations.forEach((aff) => {
      if (!affiliationMap.has(aff)) {
        affiliationMap.set(aff, affiliationMap.size + 1);
      }
    });
  });

  return (
    <div className={cn("text-[15px] text-ink", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {authors.map((author, index) => {
          const authorAffilIndices = author.affiliations
            .map((aff) => affiliationMap.get(aff))
            .filter(Boolean) as number[];

          const isLast = index === authors.length - 1;

          return (
            <span key={author.fullName + index} className="inline-flex items-baseline">
              <span className="font-medium">{author.fullName}</span>
              {showAffiliations && authorAffilIndices.length > 0 && (
                <sup className="ms-0.5 text-[11px] text-muted">
                  {authorAffilIndices.join(",")}
                  {author.isCorresponding ? "*" : ""}
                </sup>
              )}
              {!isLast && <span className="ms-1 text-muted">,</span>}
            </span>
          );
        })}
      </div>

      {showAffiliations && affiliationMap.size > 0 && (
        <ol className="mt-2 text-xs text-muted space-y-0.5 list-none ps-0">
          {Array.from(affiliationMap.entries()).map(([affil, idx]) => (
            <li key={affil} className="flex items-start gap-1">
              <span className="font-serif text-[11px] select-none">{idx}.</span>
              <span>{affil}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
