"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Role, User } from "@/lib/domain/types";
import { api } from "@/lib/api";

interface SessionContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (credentials: { email?: string; password?: string; persona?: Role }) => Promise<User>;
  register: (payload: { fullName: string; email: string; password?: string; preferredLocale?: Role extends never ? never : "en" | "fr" | "ar"; affiliation?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  switchPersona: (role: Role) => Promise<User>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const current = await api.getSession();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = async (credentials: { email?: string; password?: string; persona?: Role }) => {
    setIsLoading(true);
    try {
      const loggedIn = await api.signIn(credentials);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    password?: string;
    preferredLocale?: "en" | "fr" | "ar";
    affiliation?: string;
  }) => {
    setIsLoading(true);
    try {
      const newUser = await api.register(payload);
      setUser(newUser);
      return newUser;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await api.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchPersona = async (role: Role) => {
    return signIn({ persona: role });
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        register,
        signOut,
        switchPersona,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

export function useRole(): { role: Role | null; isAuthor: boolean; isReviewer: boolean; isEditor: boolean; isAdmin: boolean } {
  const { user } = useSession();
  const role = user?.role ?? null;
  return {
    role,
    isAuthor: role === "author",
    isReviewer: role === "reviewer",
    isEditor: role === "editor",
    isAdmin: role === "admin",
  };
}

export function RoleGuard({
  allowedRoles,
  fallback,
  children,
}: {
  allowedRoles: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <div className="p-8 text-center text-muted">Loading…</div>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="p-12 text-center">
        <h2 className="text-lg font-heading font-semibold text-ink">Access Restricted</h2>
        <p className="text-sm text-muted mt-2">
          You do not have permission to view this section with your current role.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
