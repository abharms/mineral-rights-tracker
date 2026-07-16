import Link from "next/link";

/**
 * Placeholder landing/sign-out destination — not the real marketing page.
 * The full landing page (hero, pricing, FAQ — see STRATEGY.md §6) is a
 * separate, larger task with its own future content brief. This just
 * replaces the default create-next-app boilerplate so sign-out and a
 * bare visit to "/" don't dead-end on an unbranded scaffold page.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
          <path
            d="M12 3 4 8v8l8 5 8-5V8l-8-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11" r="2.4" fill="var(--brand)" />
        </svg>
      </span>
      <h1 className="font-heading mt-5 text-3xl font-semibold tracking-tight text-foreground">
        Mineral<span className="text-brand">Tracker</span>
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Know what&apos;s happening on your minerals — wells, permits, and drilling activity, all
        in one place.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
