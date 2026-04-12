"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, CheckSquare, Home, Radar } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/compare", label: "对比", icon: Radar },
  { href: "/checklist", label: "清单", icon: CheckSquare },
  { href: "/calculator", label: "评估", icon: Calculator },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid h-16 w-full max-w-md grid-cols-4 px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex h-full flex-col items-center justify-center gap-1 rounded-md text-xs transition ${
                  isActive
                    ? "text-[var(--brand-primary)]"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
