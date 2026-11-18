"use client";

import React from "react";
import type { Author } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  User,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

export const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

interface AuthorsRepeaterProps {
  authors: Author[];
  onChange: (authors: Author[]) => void;
  errors?: Record<number, Record<string, string>>;
}

export function AuthorsRepeater({
  authors,
  onChange,
  errors = {},
}: AuthorsRepeaterProps) {
  const t = useTranslations("author.wizard");

  const handleFieldChange = (
    index: number,
    field: keyof Author,
    value: unknown
  ) => {
    const updated = [...authors];
    if (field === "affiliations") {
      const affText = typeof value === "string" ? value : "";
      updated[index] = {
        ...updated[index],
        affiliations: affText
          ? affText.split(";").map((s) => s.trim()).filter(Boolean)
          : [],
      };
    } else if (field === "isCorresponding") {
      // If marking as corresponding, can keep or toggle
      updated[index] = {
        ...updated[index],
        isCorresponding: Boolean(value),
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    onChange(updated);
  };

  const moveAuthor = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= authors.length) return;
    const updated = [...authors];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    onChange(updated);
  };

  const removeAuthor = (index: number) => {
    if (authors.length <= 1) return;
    const updated = authors.filter((_, i) => i !== index);
    // If corresponding author was removed, ensure first author is corresponding
    if (!updated.some((a) => a.isCorresponding) && updated.length > 0) {
      updated[0].isCorresponding = true;
    }
    onChange(updated);
  };

  const addAuthor = () => {
    const newAuthor: Author = {
      fullName: "",
      affiliations: [],
      email: "",
      orcid: "",
      isCorresponding: authors.length === 0,
    };
    onChange([...authors, newAuthor]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <User className="h-4 w-4 text-muted" strokeWidth={1.5} />
          <span>{t("authorsHeading")}</span>
          <span className="text-xs font-normal text-muted">
            ({authors.length})
          </span>
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAuthor}
          className="text-xs gap-1.5 h-8 border-rule"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{t("addAuthor")}</span>
        </Button>
      </div>

      <div className="space-y-4">
        {authors.map((author, index) => {
          const authorErrors = errors[index] || {};
          const isFirst = index === 0;
          const isLast = index === authors.length - 1;

          return (
            <div
              key={index}
              className="rounded-[3px] border border-rule bg-paper p-4 space-y-4 relative transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-rule pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper-alt border border-rule text-[11px] font-mono text-muted">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-ink">
                    {author.fullName || `Author ${index + 1}`}
                  </span>
                  {author.isCorresponding && (
                    <span className="text-[10px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                      {t("authorCorresponding")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveAuthor(index, -1)}
                    disabled={isFirst}
                    aria-label={`${t("moveUp")} (Author ${index + 1})`}
                    className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none hover:bg-paper-alt"
                  >
                    <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAuthor(index, 1)}
                    disabled={isLast}
                    aria-label={`${t("moveDown")} (Author ${index + 1})`}
                    className="p-1 rounded text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none hover:bg-paper-alt"
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  {authors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAuthor(index)}
                      aria-label={`${t("removeAuthor")} (Author ${index + 1})`}
                      className="p-1 rounded text-danger/80 hover:text-danger hover:bg-danger-bg/50 ms-1"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Full Name */}
                <div className="space-y-1">
                  <Label
                    htmlFor={`author-name-${index}`}
                    className="text-xs font-medium text-ink"
                  >
                    {t("authorName")}{" "}
                    <span className="text-danger" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id={`author-name-${index}`}
                    value={author.fullName}
                    onChange={(e) =>
                      handleFieldChange(index, "fullName", e.target.value)
                    }
                    placeholder="e.g. Harriet Vance"
                    className="text-xs h-8 bg-paper"
                    required
                  />
                  {authorErrors.fullName && (
                    <p className="text-[11px] text-danger flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                      {authorErrors.fullName}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <Label
                    htmlFor={`author-email-${index}`}
                    className="text-xs font-medium text-ink"
                  >
                    {t("authorEmail")}
                  </Label>
                  <Input
                    id={`author-email-${index}`}
                    type="email"
                    value={author.email || ""}
                    onChange={(e) =>
                      handleFieldChange(index, "email", e.target.value)
                    }
                    placeholder="h.vance@university.example"
                    className="text-xs h-8 bg-paper"
                  />
                  {authorErrors.email && (
                    <p className="text-[11px] text-danger flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                      {authorErrors.email}
                    </p>
                  )}
                </div>

                {/* Affiliations */}
                <div className="space-y-1">
                  <Label
                    htmlFor={`author-aff-${index}`}
                    className="text-xs font-medium text-ink"
                  >
                    {t("authorAffiliation")}
                  </Label>
                  <Input
                    id={`author-aff-${index}`}
                    value={(author.affiliations || []).join("; ")}
                    onChange={(e) =>
                      handleFieldChange(index, "affiliations", e.target.value)
                    }
                    placeholder="University of Edinburgh; Sorbonne (separate with ;)"
                    className="text-xs h-8 bg-paper"
                  />
                </div>

                {/* ORCID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`author-orcid-${index}`}
                      className="text-xs font-medium text-ink flex items-center gap-1"
                    >
                      <span>{t("authorOrcid")}</span>
                      <span className="text-[10px] text-muted font-normal font-mono">
                        0000-0000-0000-0000
                      </span>
                    </Label>
                  </div>
                  <Input
                    id={`author-orcid-${index}`}
                    value={author.orcid || ""}
                    onChange={(e) =>
                      handleFieldChange(index, "orcid", e.target.value.trim())
                    }
                    placeholder="0000-0002-1825-0097"
                    className="text-xs h-8 font-mono bg-paper"
                  />
                  {author.orcid && !ORCID_REGEX.test(author.orcid) && (
                    <p className="text-[11px] text-amber-700 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" strokeWidth={1.5} />
                      Format: 0000-0000-0000-0000 (digits or terminal X)
                    </p>
                  )}
                </div>
              </div>

              {/* Corresponding Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id={`author-corr-${index}`}
                  checked={Boolean(author.isCorresponding)}
                  onCheckedChange={(checked) =>
                    handleFieldChange(index, "isCorresponding", checked)
                  }
                />
                <Label
                  htmlFor={`author-corr-${index}`}
                  className="text-xs text-ink cursor-pointer font-normal"
                >
                  {t("authorCorresponding")}
                </Label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
