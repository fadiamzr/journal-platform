"use client";

import React, { useState } from "react";
import type { Article } from "@/lib/domain/types";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { brand } from "@/config/brand";

interface CitationBlockProps {
  article: Article;
  className?: string;
}

export function CitationBlock({ article, className }: CitationBlockProps) {
  const t = useTranslations("article");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Generate APA citation
  const authorsApa = article.authors
    .map((a) => {
      const parts = a.fullName.split(" ");
      const lastName = parts[parts.length - 1];
      const initials = parts
        .slice(0, -1)
        .map((p) => `${p[0]}.`)
        .join(" ");
      return `${lastName}, ${initials}`;
    })
    .join(", ");

  const titleEnglish =
    article.title.en ||
    article.title[article.manuscriptLanguage] ||
    Object.values(article.title)[0] ||
    "";

  const apaCitation = `${authorsApa} (${article.year || new Date().getFullYear()}). ${titleEnglish}. ${brand.name}, ${article.volume || 1}(${article.number || 1}). https://doi.org/${article.doi || "10.5555/placeholder"}`;

  // Generate BibTeX citation
  const firstAuthorLastName = (
    article.authors[0]?.fullName.split(" ").slice(-1)[0] || "author"
  ).toLowerCase();
  const bibtexKey = `${firstAuthorLastName}${article.year || 2026}${article.id}`;

  const bibtexCitation = `@article{${bibtexKey},
  author    = {${article.authors.map((a) => a.fullName).join(" and ")}},
  title     = {${titleEnglish}},
  journal   = {${brand.name}},
  year      = {${article.year || 2026}},
  volume    = {${article.volume || 1}},
  number    = {${article.number || 1}},
  doi       = {${article.doi || ""}},
  issn      = {${brand.issn.online}}
}`;

  const handleCopy = async (text: string, format: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      toast.success(t("citationCopied"));
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      toast.error("Failed to copy citation to clipboard");
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted font-body">
          {t("citation")}
        </h3>
      </div>

      <Tabs defaultValue="apa" className="w-full">
        <div className="flex items-center justify-between border-b border-rule pb-2">
          <TabsList className="bg-transparent border-0 p-0 h-auto gap-4">
            <TabsTrigger
              value="apa"
              className="px-0 py-1 border-0 rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent font-medium text-muted"
            >
              {t("apa")}
            </TabsTrigger>
            <TabsTrigger
              value="bibtex"
              className="px-0 py-1 border-0 rounded-none text-xs data-[state=active]:bg-transparent data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent font-medium text-muted"
            >
              {t("bibtex")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="apa" className="mt-3">
          <div className="relative rounded-[3px] border border-rule bg-paper-alt p-3 text-xs font-mono text-ink leading-relaxed">
            <p className="pe-8">{apaCitation}</p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-2 top-2 h-7 w-7 text-muted hover:text-ink"
              onClick={() => handleCopy(apaCitation, "apa")}
              aria-label={t("copyCitation")}
            >
              {copiedFormat === "apa" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="bibtex" className="mt-3">
          <div className="relative rounded-[3px] border border-rule bg-paper-alt p-3 text-xs font-mono text-ink leading-relaxed whitespace-pre overflow-x-auto">
            <pre className="pe-8 font-mono">{bibtexCitation}</pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-2 top-2 h-7 w-7 text-muted hover:text-ink"
              onClick={() => handleCopy(bibtexCitation, "bibtex")}
              aria-label={t("copyCitation")}
            >
              {copiedFormat === "bibtex" ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
