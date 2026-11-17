"use client";

import React, { useState, useEffect } from "react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/shared/Monogram";
import { CommandSearchDialog } from "@/components/search/CommandSearchDialog";
import { useSession } from "@/lib/auth/session-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Menu, User as UserIcon, ChevronDown, BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";

export function PublicHeader() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tPortal = useTranslations("portal");
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll listener for condensing sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Global keyboard shortcut for Command Search ("/" or "Ctrl+K")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if ((e.key === "/" && !isInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { href: "/issues/current", label: t("currentIssue") },
    { href: "/for-authors", label: t("forAuthors") },
    { href: "/about", label: t("about") },
    { href: "/editorial-board", label: t("editorialBoard") },
  ];

  const localizedRole = user ? tPortal(`roles.${user.role}`) : "";

  return (
    <header
      className={`sticky top-0 z-40 bg-paper/95 backdrop-blur-md transition-all duration-200 border-b border-rule ${
        isScrolled ? "shadow-warm py-0" : "py-0"
      }`}
    >
      {/* Skip to Content accessible landmark */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {tCommon("skipToContent")}
      </a>

      {/* ── Top Utility Strip ──────────────────────────────────────────────── */}
      <div
        className={`border-b border-rule/50 bg-paper-alt/80 text-xs text-muted transition-all duration-200 ${
          isScrolled ? "h-0 opacity-0 overflow-hidden py-0 border-b-0" : "h-8 py-0"
        }`}
      >
        <div className="max-w-content mx-auto px-4 md:px-6 h-8 flex items-center justify-between font-body">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline font-mono text-[11px] text-muted">
              ISSN {brand.issn.print} (Print) • {brand.issn.online} (Online)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="dropdown" />
            <div className="h-3 w-px bg-rule" aria-hidden="true" />
            {user ? (
              <Link
                href="/portal"
                className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-accent transition-colors"
              >
                <UserIcon className="h-3.5 w-3.5 text-accent" />
                <span>{tCommon("myPortal")}</span>
                <span className="text-[11px] text-muted">({localizedRole})</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="font-medium text-ink hover:text-accent transition-colors"
              >
                {tCommon("signIn")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Masthead & Navigation Bar ──────────────────────────────────── */}
      <div className="max-w-content mx-auto px-4 md:px-6">
        <div
          className={`flex items-center justify-between gap-4 transition-all duration-200 ${
            isScrolled ? "py-2.5 md:py-3" : "py-3.5 md:py-4"
          }`}
        >
          {/* Left: Brand Monogram + Wordmark */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[2px]"
            >
              <Monogram size={isScrolled ? 28 : 34} />
              <div>
                <span
                  className={`font-heading font-bold tracking-tight text-ink group-hover:text-accent transition-colors block leading-none ${
                    isScrolled ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                  }`}
                >
                  {brand.logo.wordmark}
                </span>
                {!isScrolled && (
                  <span className="hidden lg:block text-[11px] text-muted font-body mt-0.5 tracking-normal">
                    {brand.publisher.name}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Center: Desktop Navigation with Sliding Active Indicator */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/issues/current"
              className={`px-2.5 py-1.5 rounded-[2px] text-[14px] font-medium transition-all ${
                pathname === "/issues/current"
                  ? "text-accent bg-paper-alt border-b-2 border-accent"
                  : "text-ink/85 hover:text-accent hover:bg-paper-alt/50"
              }`}
            >
              {t("currentIssue")}
            </Link>

            {/* Archive with Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] text-[14px] font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    pathname.startsWith("/issues") && pathname !== "/issues/current"
                      ? "text-accent bg-paper-alt border-b-2 border-accent"
                      : "text-ink/85 hover:text-accent hover:bg-paper-alt/50"
                  }`}
                >
                  <span>{t("archive")}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 text-xs font-body">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted font-mono">
                  {tCommon("archiveByYear")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => router.push("/issues?year=2026")}
                  className="cursor-pointer font-medium"
                >
                  <BookOpen className="h-3.5 w-3.5 me-2 text-accent" />
                  <span>2026 (Volume 2)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/issues?year=2025")}
                  className="cursor-pointer font-medium"
                >
                  <BookOpen className="h-3.5 w-3.5 me-2 text-accent" />
                  <span>2025 (Volume 1)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/issues")}
                  className="cursor-pointer text-accent font-medium"
                >
                  <span>{tCommon("viewAllIssues")} →</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.slice(1).map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1.5 rounded-[2px] text-[14px] font-medium transition-all ${
                    isActive
                      ? "text-accent bg-paper-alt border-b-2 border-accent"
                      : "text-ink/85 hover:text-accent hover:bg-paper-alt/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Command Search Trigger + Submit CTA */}
          <div className="flex items-center gap-2.5">
            {/* Search Trigger Button */}
            <button
              type="button"
              onClick={() => setSearchDialogOpen(true)}
              aria-label={tCommon("searchPlaceholder")}
              className="flex items-center gap-2 h-8 px-2.5 rounded-[3px] border border-rule bg-paper-alt/70 hover:bg-paper-alt hover:border-accent/40 text-xs text-muted hover:text-ink transition-colors font-body"
            >
              <Search className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="hidden sm:inline text-xs">{tCommon("searchPlaceholder")}</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] text-muted/80 bg-paper px-1 py-0.2 rounded border border-rule select-none">
                /
              </kbd>
            </button>

            {/* Submit Manuscript CTA */}
            <Link href="/for-authors" className="hidden sm:inline-block">
              <Button size="sm" variant="default" className="text-xs h-8">
                {t("submitManuscript")}
              </Button>
            </Link>

            {/* Mobile Menu Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-6 font-body">
                <SheetHeader className="mb-6">
                  <SheetTitle className="text-start font-heading text-xl flex items-center gap-2">
                    <Monogram size={26} />
                    <span>{brand.name}</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-3">
                  <Link
                    href="/issues/current"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm py-1.5 font-medium hover:text-accent"
                  >
                    {t("currentIssue")}
                  </Link>
                  <Link
                    href="/issues"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm py-1.5 font-medium hover:text-accent"
                  >
                    {t("archive")}
                  </Link>
                  <Link
                    href="/for-authors"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm py-1.5 font-medium hover:text-accent"
                  >
                    {t("forAuthors")}
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm py-1.5 font-medium hover:text-accent"
                  >
                    {t("about")}
                  </Link>
                  <Link
                    href="/editorial-board"
                    onClick={() => setMobileOpen(false)}
                    className="text-sm py-1.5 font-medium hover:text-accent"
                  >
                    {t("editorialBoard")}
                  </Link>

                  <div className="pt-4 border-t border-rule space-y-2">
                    <Link
                      href="/for-authors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Button className="w-full text-xs">
                        {t("submitManuscript")}
                      </Button>
                    </Link>

                    {user ? (
                      <Link
                        href="/portal"
                        onClick={() => setMobileOpen(false)}
                        className="block text-center text-xs text-muted hover:text-ink pt-2"
                      >
                        {tCommon("myPortal")} ({localizedRole})
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="block text-center text-xs text-muted hover:text-ink pt-2"
                      >
                        {tCommon("signIn")}
                      </Link>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Command Search Dialog Overlay */}
      <CommandSearchDialog
        isOpen={searchDialogOpen}
        onClose={() => setSearchDialogOpen(false)}
      />
    </header>
  );
}
