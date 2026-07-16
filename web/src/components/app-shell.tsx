"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Map as MapIcon,
  List,
  Search,
  Briefcase,
  HelpCircle,
  ChevronDown,
  ChevronsUpDown,
  Menu,
} from "lucide-react";

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M12 3 4 8v8l8 5 8-5V8l-8-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11" r="2.4" fill="var(--brand)" />
        </svg>
      </span>
      <span className="font-heading text-base leading-tight font-semibold tracking-tight text-sidebar-foreground">
        Mineral<span className="text-brand">Tracker</span>
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

function NavGroup({
  label,
  icon: Icon,
  defaultOpen,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="mt-0.5 flex flex-col gap-0.5 pl-7">{children}</div>}
    </div>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="mb-6">
        <Wordmark />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink
          href="/dashboard"
          label="My Tracts"
          icon={List}
          active={isActive("/dashboard")}
          onNavigate={onNavigate}
        />
        <NavGroup label="Explore" icon={Search} defaultOpen={isActive("/map")}>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            List view
          </Link>
          <NavLink
            href="/map"
            label="Map view"
            icon={MapIcon}
            active={isActive("/map")}
            onNavigate={onNavigate}
          />
        </NavGroup>
        <NavGroup label="Services" icon={Briefcase}>
          <span className="rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/50">
            Talk to a consultant
          </span>
        </NavGroup>
        <NavLink
          href="/help"
          label="Help"
          icon={HelpCircle}
          active={isActive("/help")}
          onNavigate={onNavigate}
        />
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
              JW
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              James Whitfield
            </div>
            <div className="truncate text-xs text-sidebar-foreground/60">
              jwhitfield@example.com
            </div>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <DropdownMenuItem render={<Link href="/account" />}>Account settings</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/account/billing" />}>
            Billing &amp; plans
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/onboarding" />}>Add a tract</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/" />}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background md:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContents onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Wordmark />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContents />
      </aside>

      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
