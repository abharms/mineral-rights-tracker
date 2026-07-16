"use client";

import dynamic from "next/dynamic";

// MapLibre must run in the browser, so load the map client-side only.
const LateralsMap = dynamic(
  () => import("@/components/laterals-map").then((m) => m.LateralsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export default function MapPage() {
  return <LateralsMap />;
}
