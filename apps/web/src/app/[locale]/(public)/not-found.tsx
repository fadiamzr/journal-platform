import React from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <div className="py-20 text-center max-w-md mx-auto">
      <span className="text-xs font-mono text-muted uppercase tracking-widest block mb-2">
        Error 404
      </span>
      <h1 className="text-3xl font-heading font-semibold text-ink mb-3">
        {t("notFoundTitle")}
      </h1>
      <p className="text-sm text-muted mb-6 leading-relaxed">
        {t("notFoundMessage")}
      </p>
      <Link href="/">
        <Button variant="default" size="sm">
          {t("backToHome")}
        </Button>
      </Link>
    </div>
  );
}
