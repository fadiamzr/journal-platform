import React from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <PublicHeader />
      <main id="main-content" className="flex-1 max-w-content w-full mx-auto px-4 md:px-6 py-8">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
