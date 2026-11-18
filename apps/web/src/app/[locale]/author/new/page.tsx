"use client";

import React, { useEffect, useState } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SubmissionWizard } from "@/components/author/SubmissionWizard";
import { api } from "@/lib/api";
import type { Submission } from "@/lib/domain/types";
import { useTranslations } from "next-intl";

export default function NewSubmissionPage() {
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initDraft() {
      try {
        setLoading(true);
        // Create fresh draft
        const newSub = await api.createDraft({
          manuscriptLanguage: "en",
          title: {},
        });
        setDraft(newSub);
      } catch (err) {
        console.error("Failed to create draft:", err);
      } finally {
        setLoading(false);
      }
    }
    initDraft();
  }, []);

  return (
    <PortalLayout
      allowedRoles={["author", "editor", "admin"]}
      breadcrumbs={[
        { label: tNav("authorSubmissions"), href: "/author" },
        { label: tNav("newSubmission") },
      ]}
    >
      {loading || !draft ? (
        <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
          {tCommon("loading")}
        </div>
      ) : (
        <SubmissionWizard initialSubmission={draft} />
      )}
    </PortalLayout>
  );
}
