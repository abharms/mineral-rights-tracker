#!/usr/bin/env node
/**
 * Regenerates src/components/state-outline.tsx from real US state geometry
 * (us-atlas topojson, via topojson-client + d3-geo). Each state's SVG path
 * is generated with d3's geoIdentity().fitSize() — which handles scaling and
 * centering correctly — rather than hand-computed bounding boxes.
 *
 * Add new states to STATE_CODES below (per SPEC.md coverage) and re-run:
 *   node scripts/generate-state-outlines.mjs
 */
import { feature } from "topojson-client";
import { geoPath, geoIdentity } from "d3-geo";
import us from "us-atlas/states-10m.json" with { type: "json" };
import { writeFileSync } from "node:fs";

// 2-letter code -> full name (as it appears in us-atlas's properties.name).
const STATE_CODES = {
  OK: "Oklahoma",
  TX: "Texas",
  NM: "New Mexico",
};

const ICON_SIZE = 100; // path coordinates fitted into a 0..100 square

const geometries = us.objects.states.geometries;

function pathForState(name) {
  const geom = geometries.find((g) => g.properties.name === name);
  if (!geom) throw new Error(`State not found in topology: ${name}`);
  const geojson = feature(us, geom);
  // reflectY: geographic data is north-up (y increases northward), but SVG's
  // y-axis increases downward — without this the shape renders upside down.
  const projection = geoIdentity().reflectY(true).fitSize([ICON_SIZE, ICON_SIZE], geojson);
  const generator = geoPath(projection);
  return generator(geojson);
}

const entries = Object.entries(STATE_CODES).map(([code, name]) => {
  const d = pathForState(name);
  return `  ${code}: "${d}",`;
});

const out = `/**
 * Real state-outline icons for tract cards (generated from actual US state
 * geometry — see scripts/generate-state-outlines.mjs, DO NOT hand-edit).
 * All paths are fitted to a 0..100 viewBox square via d3's
 * geoIdentity().fitSize(), so every icon uses the same viewBox.
 * This only visualizes which state a tract is in (a real field we have),
 * not a parcel boundary (which we don't).
 */

const VIEW_BOX = "0 0 ${ICON_SIZE} ${ICON_SIZE}";

const PATHS: Record<string, string> = {
${entries.join("\n")}
};

const FALLBACK_PATH = "M10,10 L90,10 L90,90 L10,90 Z";

export function StateOutline({ state, className }: { state: string; className?: string }) {
  const d = PATHS[state.toUpperCase()] ?? FALLBACK_PATH;
  return (
    <svg viewBox={VIEW_BOX} className={className} fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
`;

writeFileSync(new URL("../src/components/state-outline.tsx", import.meta.url), out);
console.log("Wrote src/components/state-outline.tsx for:", Object.keys(STATE_CODES).join(", "));
