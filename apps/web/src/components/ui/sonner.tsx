"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-paper group-[.toaster]:text-ink group-[.toaster]:border-rule group-[.toaster]:shadow-sm group-[.toaster]:rounded-[3px]",
          description: "group-[.toast]:text-muted",
          actionButton:
            "group-[.toast]:bg-ink group-[.toast]:text-paper group-[.toast]:rounded-[2px]",
          cancelButton:
            "group-[.toast]:bg-paper-alt group-[.toast]:text-ink group-[.toast]:rounded-[2px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
