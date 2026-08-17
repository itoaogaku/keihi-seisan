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
    activeClass: "bg-violet-600 text-white",
    inactiveClass: "bg-violet-50 text-violet-700 hover:bg-violet-100",
  },
  {
    href: "/business-trip-report",
    label: "出張報告書",
    icon: Plane,
    isActive: (pathname: string) => pathname.startsWith("/business-trip-report"),
    activeClass: "bg-rose-500 text-white",
    inactiveClass: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
    activeClass: "bg-amber-400 text-amber-950",
    inactiveClass: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-background print:hidden">
      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                active ? tab.activeClass : tab.inactiveClass
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
