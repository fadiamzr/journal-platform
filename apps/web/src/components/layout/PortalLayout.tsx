"use client";

import React from "react";
import { PortalHeader } from "./PortalHeader";
import { useSession } from "@/lib/auth/session-context";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { ShieldAlert, RefreshCw } from "lucide-react";
import type { Role } from "@/lib/domain/types";

interface PortalLayoutProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function PortalLayout({
  children,
  allowedRoles,
  breadcrumbs,
}: PortalLayoutProps) {
  const t = useTranslations("portal");
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const { user, isLoading, switchPersona } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper-alt flex flex-col">
        <PortalHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-xs text-muted font-body animate-pulse">
            {tCommon("loading")}
          </p>
        </main>
      </div>
    );
  }

  const isUnauthorized =
    allowedRoles && (!user || !allowedRoles.includes(user.role));

  if (isUnauthorized) {
    const requiredRole = allowedRoles[0];
    return (
      <div className="min-h-screen bg-paper-alt flex flex-col">
        <PortalHeader />
        <main className="flex-1 max-w-content mx-auto px-4 md:px-6 py-16 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-paper p-4 border border-rule mb-4 shadow-sm">
            <ShieldAlert className="h-8 w-8 text-danger" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-heading font-semibold text-ink">
            {t("accessDenied")}
          </h1>
          <p className="text-xs text-muted font-body max-w-md mt-2 mb-6 leading-relaxed">
            {t("accessDeniedDesc", {
              requiredRole: t(`roles.${requiredRole}`),
              currentRole: user ? t(`roles.${user.role}`) : "None",
            })}
          </p>
          {requiredRole && (
            <Button
              onClick={() => switchPersona(requiredRole)}
              className="text-xs gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
              {requiredRole === "author"
                ? tNav("switchToAuthor")
                : requiredRole === "reviewer"
                ? tNav("switchToReviewer")
                : requiredRole === "editor"
                ? tNav("switchToEditor")
                : requiredRole === "admin"
                ? tNav("switchToAdmin")
                : t("switchPersona")}
            </Button>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-alt flex flex-col">
      <PortalHeader />
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="border-b border-rule bg-paper/60">
          <div className="max-w-content mx-auto px-4 md:px-6 py-2.5">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      )}
      <main className="flex-1 max-w-content mx-auto px-4 md:px-6 py-8 w-full">
        {children}
      </main>
    </div>
  );
}
