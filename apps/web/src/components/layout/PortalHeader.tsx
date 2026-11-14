"use client";

import React from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { useSession } from "@/lib/auth/session-context";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, RefreshCw, ChevronDown } from "lucide-react";
import type { Role } from "@/lib/domain/types";

const PERSONAS: Array<{ role: Role; label: string }> = [
  { role: "author", label: "Author (Dr. Harriet Vance)" },
  { role: "reviewer", label: "Reviewer (Prof. Arthur Pendelton)" },
  { role: "editor", label: "Editor (Prof. Hélène Vance)" },
  { role: "admin", label: "Administrator (Dr. Tariq Al-Mansoor)" },
];

export function PortalHeader() {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const { user, signOut, switchPersona } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="border-b border-rule bg-paper sticky top-0 z-40">
      <div className="max-w-content mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        {/* Wordmark and Portal indicator */}
        <div className="flex items-center gap-4">
          <Link href="/" className="font-heading font-bold text-xl text-ink tracking-tight">
            {brand.name}
          </Link>
          <span className="text-rule" aria-hidden="true">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {user?.role ? `${user.role} portal` : "Portal"}
          </span>
        </div>

        {/* User Menu & Persona Switcher */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="dropdown" />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium gap-2 border-rule"
                >
                  <User className="h-3.5 w-3.5 text-muted" />
                  <span className="hidden sm:inline">{user.fullName}</span>
                  <span className="text-[10px] text-muted capitalize">({user.role})</span>
                  <ChevronDown className="h-3 w-3 text-muted" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs">
                <DropdownMenuLabel className="font-normal text-muted py-1.5">
                  <div className="font-medium text-ink">{user.fullName}</div>
                  <div className="text-[11px] text-muted">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                  {t("switchPersona")}
                </DropdownMenuLabel>
                {PERSONAS.map((p) => (
                  <DropdownMenuItem
                    key={p.role}
                    onClick={() => switchPersona(p.role)}
                    className={`cursor-pointer ${
                      user.role === p.role ? "font-semibold text-accent bg-paper-alt" : ""
                    }`}
                  >
                    <RefreshCw className="h-3 w-3 me-2 text-muted" />
                    <span>{p.label}</span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-danger cursor-pointer focus:text-danger focus:bg-danger-bg"
                >
                  <LogOut className="h-3 w-3 me-2" />
                  <span>{tCommon("signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
