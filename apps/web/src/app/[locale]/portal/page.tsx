"use client";

import React, { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useSession } from "@/lib/auth/session-context";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { User as UserIcon } from "lucide-react";

export default function PortalRedirectPage() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role === "author") {
      router.replace("/author");
    } else if (user.role === "reviewer") {
      router.replace("/reviewer");
    } else if (user.role === "editor") {
      router.replace("/editor");
    } else if (user.role === "admin") {
      router.replace("/admin");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <PortalHeader />
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-xs text-muted font-body animate-pulse">
            {tCommon("loading")}
          </p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper-alt flex flex-col">
        <PortalHeader />
        <main className="flex-1 max-w-content mx-auto px-4 md:px-6 py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="rounded-full bg-paper p-3 border border-rule">
            <UserIcon className="h-6 w-6 text-muted" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-heading font-semibold text-ink">
            {t("sessionRequired")}
          </h1>
          <p className="text-xs text-muted font-body max-w-sm leading-relaxed">
            {t("sessionRequiredDesc")}
          </p>
          <Link href="/login">
            <Button size="sm" className="text-xs">
              {t("goToSignIn")}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <PortalHeader />
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-xs text-muted font-body animate-pulse">
          {tCommon("loading")}
        </p>
      </main>
    </div>
  );
}
