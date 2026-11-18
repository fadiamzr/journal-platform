"use client";

import React from "react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { ComingSoon } from "@/components/portal/ComingSoon";
import { useTranslations } from "next-intl";

export default function EditorPortalPage() {
  const t = useTranslations("portal");

  return (
    <PortalLayout
      allowedRoles={["editor", "admin"]}
      breadcrumbs={[{ label: t("editorComingSoonTitle") }]}
    >
      <ComingSoon role="editor" />
    </PortalLayout>
  );
}
