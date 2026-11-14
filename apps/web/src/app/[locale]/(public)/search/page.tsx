import React, { Suspense } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInterface } from "@/components/search/SearchInterface";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "search" });
  const articles = await api.listArticles();
  const issues = await api.listIssues();

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Suspense fallback={<div className="py-8 text-center text-muted">Loading search…</div>}>
        <SearchInterface initialArticles={articles} issues={issues} />
      </Suspense>
    </div>
  );
}
