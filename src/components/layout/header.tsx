import Link from "next/link";
import { House } from "lucide-react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/compare", label: "对比器" },
  { href: "/checklist", label: "Checklist" },
  { href: "/calculator", label: "评估" },
];

export function Header() {
  return (
    <header className="hidden border-b border-slate-200 bg-white/95 backdrop-blur md:block">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-slate-900">
          <House className="h-5 w-5 text-[var(--brand-primary)]" />
          <span className="text-sm font-semibold tracking-wide">FastHousing</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
