import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav, AdminNavPills, type AdminNavItem } from "@/components/admin/admin-nav";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · AI Atlas" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // `requireRole` throws rather than redirecting, so the gate is expressed here
  // as a redirect and re-asserted inside every server action.
  const [user, dict] = await Promise.all([getCurrentUser(), getDictionary()]);
  if (!user) redirect("/login?redirectTo=/admin");
  if (!hasRole(user, "editor")) redirect("/");

  const nav: AdminNavItem[] = [
    { href: "/admin", label: dict.admin.overview, icon: "layout", description: dict.admin.overviewHint },
    { href: "/admin/review", label: dict.admin.review, icon: "list-checks", description: dict.admin.reviewHint },
    { href: "/admin/resources", label: dict.admin.resources, icon: "layers", description: dict.admin.resourcesHint },
    { href: "/admin/topics", label: dict.admin.topics, icon: "compass", description: dict.admin.topicsHint },
  ];

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-hairline bg-surface p-3 shadow-card">
          <p className="px-2.5 pt-1 pb-3 text-[11px] font-semibold tracking-[0.12em] text-brand-600 uppercase">
            {dict.admin.editorial}
          </p>

          <AdminNav items={nav} />

          <div className="mt-3 border-t border-hairline pt-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <Icon name="arrow-left" className="size-4 text-slate-400" />
              {dict.common.backToSite}
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-2.5 border-t border-hairline px-2.5 pt-3">
            <Avatar src={user.avatarUrl} name={user.displayName} size={32} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-ink">{user.displayName}</p>
              <p className="text-[11px] text-muted capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-5 lg:hidden">
          <AdminNavPills items={nav} />
        </div>
        {children}
      </div>
    </div>
  );
}
