import React from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { setRequestLocale } from "next-intl/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AuthLayout>{children}</AuthLayout>;
}
