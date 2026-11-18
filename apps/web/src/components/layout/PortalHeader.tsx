"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { useSession } from "@/lib/auth/session-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  User,
  LogOut,
  RefreshCw,
  ChevronDown,
  Bell,
  Check,
  ExternalLink,
} from "lucide-react";
import type { Role, Notification } from "@/lib/domain/types";
import { stripHonorifics } from "@/lib/utils";

const IS_MOCK_MODE =
  (process.env.NEXT_PUBLIC_API_MODE?.toLowerCase() || "mock") === "mock";

const PERSONAS: Array<{ role: Role; label: string }> = [
  { role: "author", label: "Author (Harriet Vance)" },
  { role: "reviewer", label: "Reviewer (Arthur Pendelton)" },
  { role: "editor", label: "Editor (Hélène Vance)" },
  { role: "admin", label: "Admin (Tariq Al-Mansoor)" },
];

export function PortalHeader() {
  const t = useTranslations("portal");
  const tNav = useTranslations("portalNav");
  const tCommon = useTranslations("common");
  const { user, signOut, switchPersona } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingNotifs(true);
      const items = await api.getNotifications();
      setNotifications(items);
    } catch {
      // Ignore in background
    } finally {
      setLoadingNotifs(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleSwitchPersona = async (role: Role) => {
    await switchPersona(role);
    if (role === "author") {
      router.push("/author");
    } else if (role === "reviewer") {
      router.push("/reviewer");
    } else if (role === "editor") {
      router.push("/editor");
    } else if (role === "admin") {
      router.push("/admin");
    } else {
      router.push("/portal");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Ignore
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.read) {
        await api.markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      }
      if (notif.link) {
        router.push(notif.link as Parameters<typeof router.push>[0]);
      }
    } catch {
      // Ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Determine portal role navigation
  const authorLinks = [
    {
      href: "/author",
      label: tNav("authorSubmissions"),
      isActive:
        pathname === "/author" ||
        (pathname.startsWith("/author/") &&
          !pathname.startsWith("/author/new") &&
          !pathname.startsWith("/author/profile")),
    },
    {
      href: "/author/new",
      label: tNav("newSubmission"),
      isActive: pathname.startsWith("/author/new"),
    },
    {
      href: "/author/profile",
      label: tNav("authorProfile"),
      isActive: pathname.startsWith("/author/profile"),
    },
  ];

  const reviewerLinks = [
    {
      href: "/reviewer",
      label: tNav("reviewerReviews"),
      isActive:
        pathname === "/reviewer" ||
        (pathname.startsWith("/reviewer/") &&
          !pathname.startsWith("/reviewer/guidelines") &&
          !pathname.startsWith("/reviewer/profile")),
    },
    {
      href: "/reviewer/guidelines",
      label: tNav("reviewerGuidelines"),
      isActive: pathname.startsWith("/reviewer/guidelines"),
    },
    {
      href: "/reviewer/profile",
      label: tNav("reviewerProfile"),
      isActive: pathname.startsWith("/reviewer/profile"),
    },
  ];

  const currentRole = user?.role;
  const navLinks =
    currentRole === "author"
      ? authorLinks
      : currentRole === "reviewer"
      ? reviewerLinks
      : [];

  return (
    <header className="border-b border-rule bg-paper sticky top-0 z-40">
      <div className="max-w-content mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand & Portal Type */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-heading font-bold text-lg md:text-xl text-ink tracking-tight hover:opacity-85 transition-opacity"
          >
            {brand.name}
          </Link>
          <span className="text-rule hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted hidden sm:inline">
            {currentRole === "author"
              ? tNav("authorPortal")
              : currentRole === "reviewer"
              ? tNav("reviewerPortal")
              : currentRole === "editor"
              ? tNav("editorPortal")
              : currentRole === "admin"
              ? tNav("adminPortal")
              : tNav("portalTitle")}
          </span>
        </div>

        {/* Role-Specific Navigation Links */}
        {navLinks.length > 0 && (
          <nav
            aria-label="Portal Navigation"
            className="hidden md:flex items-center gap-1 h-full"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as Parameters<typeof Link>[0]["href"]}
                aria-current={link.isActive ? "page" : undefined}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  link.isActive
                    ? "bg-paper-alt text-ink font-semibold border-b-2 border-accent"
                    : "text-muted hover:text-ink hover:bg-paper-alt/50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right Controls: Notifications, Language, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={tNav("unreadNotifications", { count: unreadCount })}
                  className="relative p-2 rounded-md hover:bg-paper-alt text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
                >
                  <Bell className="h-4 w-4" strokeWidth={1.5} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-contrast">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 text-xs shadow-lg">
                <div className="p-3 border-b border-rule flex items-center justify-between bg-paper-alt/40">
                  <div className="font-semibold text-ink flex items-center gap-2">
                    <span>{tNav("notifications")}</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-accent/15 text-accent font-semibold px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                    >
                      <Check className="h-3 w-3" strokeWidth={1.5} />
                      {tNav("markAllRead")}
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-rule">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-muted">
                      {loadingNotifs ? tCommon("loading") : tNav("noNotifications")}
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 cursor-pointer transition-colors hover:bg-paper-alt/60 flex items-start gap-2.5 ${
                          !notif.read ? "bg-accent/5 font-medium" : "text-muted"
                        }`}
                      >
                        <span
                          className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                            !notif.read ? "bg-accent" : "bg-transparent"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <div className="text-xs text-ink font-semibold flex items-center justify-between gap-2">
                            <span className="truncate">{notif.title}</span>
                            <span className="text-[10px] text-muted font-normal flex-shrink-0">
                              {new Date(notif.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <LanguageSwitcher variant="dropdown" />

          {/* User Menu & Persona Switcher */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium gap-2 border-rule bg-paper"
                >
                  <User className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {stripHonorifics(user.fullName)}
                  </span>
                  <span className="text-[10px] text-muted capitalize">
                    ({user.role})
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted" strokeWidth={1.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 text-xs shadow-lg">
                <DropdownMenuLabel className="font-normal py-2">
                  <div className="font-semibold text-ink text-sm truncate">
                    {stripHonorifics(user.fullName)}
                  </div>
                  <div className="text-[11px] text-muted truncate">{user.email}</div>
                  {user.affiliation && (
                    <div className="text-[10px] text-muted truncate mt-0.5">
                      {user.affiliation}
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Profile Link */}
                <DropdownMenuItem
                  onClick={() => {
                    const profilePath =
                      user.role === "reviewer"
                        ? "/reviewer/profile"
                        : "/author/profile";
                    router.push(profilePath);
                  }}
                  className="cursor-pointer"
                >
                  <User className="h-3 w-3 me-2 text-muted" strokeWidth={1.5} />
                  <span>
                    {user.role === "reviewer"
                      ? tNav("reviewerProfile")
                      : tNav("authorProfile")}
                  </span>
                </DropdownMenuItem>

                {/* Public Site Link */}
                <DropdownMenuItem
                  onClick={() => router.push("/")}
                  className="cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3 me-2 text-muted" strokeWidth={1.5} />
                  <span>{tCommon("backToHome")}</span>
                </DropdownMenuItem>

                {IS_MOCK_MODE && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer text-xs">
                        <RefreshCw className="h-3 w-3 me-2 text-muted" strokeWidth={1.5} />
                        <span>{t("switchPersona")}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 text-xs shadow-lg">
                        {PERSONAS.map((p) => (
                          <DropdownMenuItem
                            key={p.role}
                            onClick={() => handleSwitchPersona(p.role)}
                            className={`cursor-pointer ${
                              user.role === p.role ? "font-semibold text-accent bg-paper-alt" : ""
                            }`}
                          >
                            <span>{p.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-danger cursor-pointer focus:text-danger focus:bg-danger-bg"
                >
                  <LogOut className="h-3 w-3 me-2" strokeWidth={1.5} />
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
