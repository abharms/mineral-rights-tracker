"use client";

import { useCallback, useRef, useState } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  Popup,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
  type LayerProps,
} from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/lib/supabase/client";

// Free basemap (no API key). Override with NEXT_PUBLIC_MAP_STYLE if desired.
const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ??
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const MAX_FEATURES = 6000;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const lateralLayer: LayerProps = {
  id: "laterals-line",
  type: "line",
  paint: {
    "line-color": "#c026d3",
    "line-opacity": 0.85,
    // slightly thicker as you zoom in
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 10, 2.5, 14, 4],
  },
};

type PopupInfo = {
  longitude: number;
  latitude: number;
  props: Record<string, unknown>;
};

export function LateralsMap() {
  const supabase = useRef(createClient()).current;
  const mapRef = useRef<MapRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [data, setData] = useState<FeatureCollection>(EMPTY);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [capped, setCapped] = useState(false);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const fetchInBounds = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const { data: fc, error } = await supabase
      .rpc("activity_in_bbox", {
        min_lng: b.getWest(),
        min_lat: b.getSouth(),
        max_lng: b.getEast(),
        max_lat: b.getNorth(),
        max_features: MAX_FEATURES,
      })
      .abortSignal(controller.signal);

    if (controller.signal.aborted) return;
    setLoading(false);

    if (error) {
      console.error("activity_in_bbox failed:", error.message);
      return;
    }
    const collection = (fc as unknown as FeatureCollection) ?? EMPTY;
    setData(collection);
    setCount(collection.features.length);
    setCapped(collection.features.length >= MAX_FEATURES);
  }, [supabase]);

  const scheduleFetch = useCallback(
    (_e?: ViewStateChangeEvent) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchInBounds, 250);
    },
    [fetchInBounds],
  );

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setPopup(null);
      return;
    }
    setPopup({
      longitude: e.lngLat.lng,
      latitude: e.lngLat.lat,
      props: feature.properties as Record<string, unknown>,
    });
  }, []);

  return (
    <div className="relative h-screen w-screen">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -97.8, latitude: 35.6, zoom: 6.2 }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["laterals-line"]}
        onLoad={fetchInBounds}
        onMoveEnd={scheduleFetch}
        onClick={onClick}
      >
        <NavigationControl position="top-right" />
        <Source id="laterals" type="geojson" data={data}>
          <Layer {...lateralLayer} />
        </Source>

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => setPopup(null)}
            closeOnClick={false}
          >
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold">
                {String(popup.props.well_name ?? "Unknown well")}
              </div>
              <div>{String(popup.props.operator ?? "")}</div>
              <div className="text-muted-foreground">
                {String(popup.props.county ?? "")} County, {String(popup.props.state ?? "")}
              </div>
              <div className="text-muted-foreground">
                API {String(popup.props.api_number ?? "—")}
                {popup.props.event_date ? ` · ${String(popup.props.event_date)}` : ""}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Overlay: legend + live count */}
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-background/90 px-4 py-3 text-sm shadow-md backdrop-blur">
        <div className="font-semibold">Oklahoma horizontal laterals</div>
        <div className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-0.5 w-6" style={{ background: "#c026d3" }} />
          <span>surface → bottom-hole trace</span>
        </div>
        <div className="mt-1 text-muted-foreground">
          {loading ? "Loading…" : `${count.toLocaleString()} in view`}
          {capped ? " (zoom in for more)" : ""}
        </div>
      </div>
    </div>
  );
}
