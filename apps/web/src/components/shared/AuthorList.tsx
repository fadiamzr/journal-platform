import React from "react";
import type { Author } from "@/lib/domain/types";
import { cn, cleanAuthorName } from "@/lib/utils";

interface AuthorListProps {
  authors: Author[];
  showAffiliations?: boolean;
  className?: string;
  locale?: string;
}

export function AuthorList({
  authors,
  showAffiliations = true,
  className,
  locale = "en",
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

  const isAr = locale === "ar";
  const isFr = locale === "fr";

  return (
    <div className={cn("text-[15px] text-ink", className)}>
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
        {authors.map((author, index) => {
          const authorAffilIndices = author.affiliations
            .map((aff) => affiliationMap.get(aff))
            .filter(Boolean) as number[];

          const cleanedName = cleanAuthorName(author.fullName);
          const isLast = index === authors.length - 1;
          const isPenultimate = index === authors.length - 2;

          let separator = "";
          if (!isLast) {
            if (authors.length === 2 && isPenultimate) {
              separator = isAr ? " و" : isFr ? " et " : " and ";
            } else if (isPenultimate) {
              // Last separator in list of 3+
              separator = isAr ? "، و" : isFr ? " et " : ", and ";
            } else {
              separator = isAr ? "، " : ", ";
            }
          }

          return (
            <React.Fragment key={author.fullName + index}>
              <span className="inline-flex items-baseline">
                <span className="font-medium text-ink">{cleanedName}</span>
                {showAffiliations && authorAffilIndices.length > 0 && (
                  <sup className="ms-0.5 text-[11px] text-muted font-mono select-none">
                    {authorAffilIndices.join(",")}
                    {author.isCorresponding ? "*" : ""}
                  </sup>
                )}
              </span>
              {!isLast && (
                <span className="text-muted select-none">{separator}</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {showAffiliations && affiliationMap.size > 0 && (
        <ol className="mt-2.5 text-xs text-muted space-y-1 list-none ps-0">
          {Array.from(affiliationMap.entries()).map(([affil, idx]) => (
            <li key={affil} className="flex items-start gap-1.5 font-body">
              <span className="font-mono text-[11px] text-accent select-none mt-0.5">
                {idx}.
              </span>
              <span>{affil}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
