import React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { ArchiveView } from "@/components/archive/ArchiveView";
import { ScrollReveal } from "@/components/shared/ScrollReveal";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "archive" });
  const issues = await api.listIssues();

  return (
    <div className="space-y-10 pb-12">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {issues.length === 0 ? (
        <EmptyState description={t("emptyState")} />
      ) : (
        <ScrollReveal>
          <ArchiveView issues={issues} locale={locale} />
        </ScrollReveal>
      )}
    </div>
  );
}
