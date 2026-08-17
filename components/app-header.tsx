"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/",
    label: "経費精算",
    icon: Receipt,
    isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/new"),
  },
  {
    href: "/business-trip-report",
    label: "出張報告書",
    icon: Plane,
    isActive: (pathname: string) => pathname.startsWith("/business-trip-report"),
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-background print:hidden">
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
