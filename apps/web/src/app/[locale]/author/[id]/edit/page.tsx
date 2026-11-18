"use client";

import React, { useEffect, useState, use } from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SubmissionWizard } from "@/components/author/SubmissionWizard";
import { api } from "@/lib/api";
import type { Submission } from "@/lib/domain/types";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

interface EditDraftPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function EditDraftPage({ params }: EditDraftPageProps) {
  const resolvedParams = use(params);
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [draft, setDraft] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadDraft() {
      try {
        setLoading(true);
        const sub = await api.getSubmission(resolvedParams.id);
        if (!sub) {
          setNotFound(true);
          return;
        }
        if (sub.status !== "draft") {
          // If already submitted, navigate to read-only view
          router.replace(`/author/${sub.id}`);
          return;
        }
        setDraft(sub);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadDraft();
  }, [resolvedParams.id, router]);

  return (
    <PortalLayout
      allowedRoles={["author", "editor", "admin"]}
      breadcrumbs={[
        { label: tNav("authorSubmissions"), href: "/author" },
        { label: draft?.title[draft.manuscriptLanguage] || resolvedParams.id },
      ]}
    >
      {loading ? (
        <div className="rounded border border-rule bg-paper p-12 text-center text-xs text-muted animate-pulse">
          {tCommon("loading")}
        </div>
      ) : notFound || !draft ? (
        <div className="rounded border border-rule bg-paper p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-ink">Submission not found</p>
          <p className="text-xs text-muted">
            The requested draft could not be found or you do not have permission to view it.
          </p>
        </div>
      ) : (
        <SubmissionWizard initialSubmission={draft} />
      )}
    </PortalLayout>
  );
}
