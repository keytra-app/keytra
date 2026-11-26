"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LogOutIcon, UsersIcon } from "@/components/ui/icons";
import { logoutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";

type Crumb = { label: string; href?: string; mono?: boolean };

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Projekte" }];
  }

  if (segments[0] === "settings" && segments[1] === "users") {
    return [{ label: "Projekte", href: "/" }, { label: "Team & Einladungen" }];
  }

  if (segments[0] === "projects" && segments[1]) {
    const slug = decodeURIComponent(segments[1]);
    if (segments[2] === "translate" && segments[3]) {
      const locale = decodeURIComponent(segments[3]);
      return [
        { label: "Projekte", href: "/" },
        { label: slug, href: `/projects/${segments[1]}`, mono: true },
        { label: locale, mono: true },
      ];
    }
    return [
      { label: "Projekte", href: "/" },
      { label: slug, mono: true },
    ];
  }

  return [{ label: "Projekte", href: "/" }];
}

export function Topbar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);
  const isUsersActive = pathname.startsWith("/settings/users");

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#09090b]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-13 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-700 bg-[#111113] font-mono text-[11px] font-semibold text-zinc-100">
              K
            </span>
            <span>Keytra</span>
          </Link>

          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500"
          >
            {crumbs.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-1.5">
                <span className="text-zinc-700 select-none">/</span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className={`truncate transition-colors hover:text-zinc-200 ${crumb.mono ? "font-mono" : ""}`}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`truncate text-zinc-200 ${crumb.mono ? "font-mono" : "font-medium"}`}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user.role === "admin" && (
            <Link
              href="/settings/users"
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                isUsersActive
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-[#111113] hover:text-zinc-100"
              }`}
            >
              <UsersIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Team</span>
            </Link>
          )}

          <div className="hidden h-4 w-px bg-zinc-800 sm:block" />

          <div className="flex items-center gap-2">
            <span className="hidden max-w-36 truncate text-xs text-zinc-300 md:inline">
              {user.name}
            </span>
            <Badge mono className="text-zinc-400">
              {user.role}
            </Badge>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Abmelden"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-[#111113] hover:text-zinc-100 cursor-pointer"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
