import React from "react";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ArticleReader } from "@/components/article/ArticleReader";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatVolumeIssue } from "@/lib/utils";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await api.getArticle(id);
  if (!article) return { title: "Article Not Found" };

  const title =
    article.title.en ||
    article.title[article.manuscriptLanguage] ||
    Object.values(article.title)[0] ||
    "Article";

  return {
    title,
    description:
      article.abstract.en ||
      article.abstract[article.manuscriptLanguage] ||
      Object.values(article.abstract)[0] ||
      "",
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations({ locale, namespace: "nav" });

  const article = await api.getArticle(id);
  if (!article) {
    notFound();
  }

  const breadcrumbs = [
    { label: tNav("home"), href: "/" },
    { label: tNav("archive"), href: "/issues" },
    ...(article.issueId
      ? [
          {
            label: formatVolumeIssue(article.volume ?? 1, article.number ?? 1, locale),
            href: `/issues/${article.issueId}`,
          },
        ]
      : []),
    {
      label:
        article.title[locale as keyof typeof article.title] ||
        article.title[article.manuscriptLanguage] ||
        "Article",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Breadcrumbs items={breadcrumbs} />
      </div>
      <ArticleReader article={article} />
    </div>
  );
}
