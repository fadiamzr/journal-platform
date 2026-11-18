"use client";

import React from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ComingSoon } from "@/components/portal/ComingSoon";
import { useTranslations } from "next-intl";

export default function AdminPortalPage() {
  const t = useTranslations("portal");

  return (
    <PortalLayout
      allowedRoles={["admin"]}
      breadcrumbs={[{ label: t("adminComingSoonTitle") }]}
    >
      <ComingSoon role="admin" />
    </PortalLayout>
  );
}
