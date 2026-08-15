"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { LocaleToggle, ThemeToggle } from "@/components/layout/preference-toggles";
import { SearchBox } from "@/components/search/search-box";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";
import { signOutAction } from "@/app/actions/auth";
import { useDictionary } from "@/components/providers/preferences-provider";
import type { SessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const dict = useDictionary();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
    setResourcesOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const primaryNav = [
    { href: "/explore", label: dict.nav.explore },
    { href: "/paths", label: dict.nav.paths },
    { href: "/trending", label: dict.nav.trending },
  ];
  const resourceMenu = [
    { href: "/resources", label: dict.resourcesMenu.all, icon: "layers", description: dict.resourcesMenu.allHint },
    { href: "/resources?type=paper", label: dict.resourcesMenu.paper, icon: "file-text", description: dict.resourcesMenu.paperHint },
    { href: "/resources?type=course", label: dict.resourcesMenu.course, icon: "graduation-cap", description: dict.resourcesMenu.courseHint },
    { href: "/resources?type=github", label: dict.resourcesMenu.github, icon: "github", description: dict.resourcesMenu.githubHint },
    { href: "/resources?type=blog", label: dict.resourcesMenu.blog, icon: "pen-line", description: dict.resourcesMenu.blogHint },
    { href: "/resources?type=video", label: dict.resourcesMenu.video, icon: "play", description: dict.resourcesMenu.videoHint },
    { href: "/resources?type=book", label: dict.resourcesMenu.book, icon: "book-open", description: dict.resourcesMenu.bookHint },
    { href: "/resources?type=tool", label: dict.resourcesMenu.tool, icon: "wrench", description: dict.resourcesMenu.toolHint },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}

          <div className="relative" onMouseEnter={() => setResourcesOpen(true)} onMouseLeave={() => setResourcesOpen(false)}>
            <button
              type="button"
              aria-expanded={resourcesOpen}
              onClick={() => setResourcesOpen((open) => !open)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActive("/resources") ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
              )}
            >
              {dict.nav.resources}
              <Icon name="chevron-down" className={cn("size-3.5 transition-transform", resourcesOpen && "rotate-180")} />
            </button>
            {resourcesOpen ? (
              <div className="absolute top-full left-0 w-[26rem] pt-2">
                <div className="grid grid-cols-2 gap-0.5 rounded-xl border border-hairline bg-surface p-2 shadow-lift">
                  {resourceMenu.map((item) => (
                    <Link key={item.href} href={item.href} className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-hover">
                      <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon name={item.icon} className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{item.label}</span>
                        <span className="block truncate text-[11px] text-muted">{item.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/about"
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive("/about") ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            {dict.nav.about}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label={dict.nav.search}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <Icon name="search" className="size-4" />
          </button>

          <LocaleToggle />
          <ThemeToggle />

          <ButtonLink href="/submit" variant="outline" size="sm" className="hidden sm:inline-flex">
            {dict.nav.submit}
          </ButtonLink>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link href="/me" className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-hover" title={user.displayName}>
                <Avatar src={user.avatarUrl} name={user.displayName} size={26} />
                <span className="hidden text-[13px] font-medium text-ink xl:inline">{user.displayName.split(" ")[0]}</span>
              </Link>
              {(user.role === "admin" || user.role === "editor") && (
                <Link
                  href="/admin"
                  className="hidden rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-hover hover:text-ink lg:inline-flex"
                >
                  {dict.nav.admin}
                </Link>
              )}
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label={dict.nav.signOut}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
                >
                  <Icon name="log-out" className="size-4" />
                </button>
              </form>
            </div>
          ) : (
            <ButtonLink href="/login" size="sm">
              {dict.nav.signIn}
            </ButtonLink>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={dict.nav.menu}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-hover lg:hidden"
          >
            <Icon name={menuOpen ? "x" : "menu"} className="size-4" />
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-hairline bg-surface px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <SearchBox autoFocus placeholder={dict.search.placeholderShort} />
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="border-t border-hairline bg-surface px-4 py-3 lg:hidden">
          <nav className="grid gap-0.5">
            {[...primaryNav, { href: "/resources", label: dict.nav.allResources }, { href: "/about", label: dict.nav.about }].map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-hover",
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
            <Link href="/submit" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              {dict.common.submit}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
