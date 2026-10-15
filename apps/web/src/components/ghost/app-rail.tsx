"use client";

import { Coins, Inbox, LayoutDashboard, ScrollText, Sprout, Users, Workflow, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/cn";
import { Logo } from "./logo";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Workspace", icon: LayoutDashboard },
  { href: "/recovery", label: "Recovery", icon: Coins },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/collections", label: "Collections", icon: Workflow },
  { href: "/expansion", label: "Growth", icon: Sprout },
  { href: "/outbox", label: "Outbox", icon: Inbox },
  { href: "/audit", label: "Audit", icon: ScrollText },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Forest left rail: logo, primary navigation, test-mode marker. Collapses to icons below lg. */
export function AppRail() {
  const pathname = usePathname();
  return (
    <aside className="z-30 w-16 shrink-0 bg-rail text-rail-fg lg:w-60">
      <div className="sticky top-0 flex h-dvh flex-col">
        <div className="flex h-16 items-center px-5 text-petal">
          <Link href="/" aria-label="Ghost home" className="rounded-control">
            <span className="hidden lg:inline-flex">
              <Logo variant="lockup" size={24} />
            </span>
            <span className="inline-flex lg:hidden">
              <Logo variant="symbol" size={24} />
            </span>
          </Link>
        </div>

        <nav aria-label="Primary" className="mt-4 flex-1 px-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href as never}
                    aria-current={active ? "page" : undefined}
                    title={label}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-180 ease-ghost",
                      active ? "bg-petal text-forest" : "text-rail-muted hover:bg-white/6 hover:text-rail-fg",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
                    <span className="hidden lg:inline">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden px-5 pb-5 lg:block">
          <div className="rounded-card border border-white/8 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-rail-fg">
              <span aria-hidden className="size-1.5 rounded-full bg-lemon" />
              Stripe test mode
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-rail-muted">
              Sapora Networks · invoices require human approval
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
