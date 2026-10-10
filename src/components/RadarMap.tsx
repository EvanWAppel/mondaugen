"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  addProtocol,
  removeProtocol,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  CLOUD_MAX_ZOOM,
  CLOUD_PROTOCOL,
  cloudTileUrl,
  fetchLatestCloudTime,
  loadCloudTile,
} from "@/lib/clouds";
import {
  fetchRadarFrames,
  radarTileUrl,
  type RadarFrame,
} from "@/lib/radar";
import type { Location } from "@/lib/types";
import { useUnit } from "@/lib/unitStore";
import { displaySpeed, windUnitLabel } from "@/lib/wind";
import MapLayerToggle, { type MapLayerMode } from "./MapLayerToggle";
import RadarTimeline from "./RadarTimeline";
import WindOverlay, { windCaption, type WindStatus } from "./WindOverlay";

// Keyless OSM raster base map (no Mapbox token) — see PRD §5. Rendered as a
// muted dark-grey map (greyscale, brightness range inverted: light labels, major
// roads mid-grey, minor roads fade out) so radar colours
// and white clouds stand out instead of competing with OSM's greens and roads.
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -1,
        "raster-brightness-min": 0.85,
        "raster-brightness-max": 0.12,
      },
    },
  ],
};

const RADAR_OPACITY = 0.85;
const RADAR_OPACITY_BOTH = 0.6;
const CLOUD_OPACITY = 0.75;
const CLOUD_LAYER_ID = "clouds";
const PLAYBACK_MS = 600;

function radarOpacity(mode: MapLayerMode): number {
  if (mode === "wind") return 0;
  if (mode === "both") return RADAR_OPACITY_BOTH;
  return RADAR_OPACITY;
}

function mapLabel(mode: MapLayerMode): string {
  if (mode === "wind") return "Wind map";
  if (mode === "both") return "Radar and wind map";
  return "Radar map";
}
// RainViewer radar tiles are served up to zoom 7; beyond that the API returns a
// "Zoom Level Not Supported" placeholder. The map itself stops at that zoom so
// radar (and the z7 satellite clouds) are never stretched into a blur.
const RADAR_MAX_ZOOM = 7;
const INITIAL_ZOOM = 6;

function cloudCaption(time: string): string {
  return `Clouds ${time.slice(11, 16)} UTC · GOES-East satellite (Americas)`;
}

interface RadarMapProps {
  location: Location;
}

function layerId(index: number): string {
  return `radar-${index}`;
}

export default function RadarMap({ location }: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialCenter = useRef<[number, number]>([
    location.longitude,
    location.latitude,
  ]);

  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MapLayerMode>("both");
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [windError, setWindError] = useState<string | null>(null);
  const [cloudsOn, setCloudsOn] = useState(false);
  const [cloudTime, setCloudTime] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [windStatus, setWindStatus] = useState<WindStatus>({
    loading: true,
    failed: false,
    coarse: false,
    time: null,
    speedMs: null,
  });
  const [unit] = useUnit();

  // Initialize the base map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: OSM_STYLE,
      center: initialCenter.current,
      zoom: INITIAL_ZOOM,
      maxZoom: RADAR_MAX_ZOOM,
    });
    addProtocol(CLOUD_PROTOCOL, loadCloudTile);
    map.addControl(new NavigationControl(), "top-right");
    // Surface MapLibre errors instead of failing silently (FR-6).
    map.on("error", (e) => console.error("[radar-map] maplibre error", e));
    mapRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      removeProtocol(CLOUD_PROTOCOL);
      mapRef.current = null;
    };
  }, []);

  // Recenter when the active location changes (MAP-05).
  useEffect(() => {
    mapRef.current?.easeTo({
      center: [location.longitude, location.latitude],
    });
  }, [location.latitude, location.longitude]);

  // Fetch the radar frame index once, then add a transparent raster layer per
  // frame; playback toggles opacity (the standard RainViewer pattern).
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const result = await fetchRadarFrames({ signal: controller.signal });
        setFrames(result.frames);
        // Start on the most recent past frame.
        const lastPast = result.frames.filter((f) => f.kind === "past").length;
        setCurrent(Math.max(0, lastPast - 1));

        const map = mapRef.current;
        if (!map) return;
        const addLayers = () => {
          result.frames.forEach((frame, i) => {
            const id = layerId(i);
            if (map.getSource(id)) return;
            map.addSource(id, {
              type: "raster",
              tiles: [radarTileUrl(result.host, frame)],
              tileSize: 256,
              maxzoom: RADAR_MAX_ZOOM,
            });
            map.addLayer({
              id,
              type: "raster",
              source: id,
              paint: {
                "raster-opacity": 0,
                "raster-opacity-transition": { duration: 0 },
              },
            });
          });
        };
        if (map.isStyleLoaded()) addLayers();
        else map.once("load", addLayers);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Couldn't load radar frames.",
        );
      }
    })();
    return () => controller.abort();
  }, []);

  // Show only the current frame's layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || frames.length === 0) return;
    const apply = () => {
      frames.forEach((_, i) => {
        if (map.getLayer(layerId(i))) {
          map.setPaintProperty(
            layerId(i),
            "raster-opacity",
            i === current ? radarOpacity(mode) : 0,
          );
        }
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [current, frames, mode]);

  // Resolve the latest satellite image the first time clouds are switched on.
  useEffect(() => {
    if (!cloudsOn || cloudTime) return;
    const controller = new AbortController();
    fetchLatestCloudTime({ signal: controller.signal })
      .then(setCloudTime)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setCloudsOn(false);
        setCloudError(
          err instanceof Error ? err.message : "Couldn't load satellite clouds.",
        );
      });
    return () => controller.abort();
  }, [cloudsOn, cloudTime]);

  // Add the cloud layer beneath the radar, or show/hide it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cloudTime) return;
    const apply = () => {
      if (!map.getSource(CLOUD_LAYER_ID)) {
        if (!cloudsOn) return;
        map.addSource(CLOUD_LAYER_ID, {
          type: "raster",
          tiles: [cloudTileUrl(cloudTime)],
          tileSize: 256,
          maxzoom: CLOUD_MAX_ZOOM,
          attribution: "Clouds: NASA GIBS / NOAA GOES-East",
        });
        map.addLayer(
          {
            id: CLOUD_LAYER_ID,
            type: "raster",
            source: CLOUD_LAYER_ID,
            paint: { "raster-opacity": CLOUD_OPACITY },
          },
          map.getLayer(layerId(0)) ? layerId(0) : undefined,
        );
        return;
      }
      map.setLayoutProperty(
        CLOUD_LAYER_ID,
        "visibility",
        cloudsOn ? "visible" : "none",
      );
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [cloudsOn, cloudTime]);

  // Advance frames while playing. Wind-only has no timeline, so don't keep
  // stepping precipitation behind it.
  useEffect(() => {
    if (!playing || frames.length === 0 || mode === "wind") return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % frames.length);
    }, PLAYBACK_MS);
    return () => clearInterval(timer);
  }, [playing, frames.length, mode]);

  const selectMode = (next: MapLayerMode) => {
    setMode(next);
    if (next === "radar") setWindError(null);
    if (next === "wind") setPlaying(false);
  };

  const toggleClouds = () => {
    setCloudError(null);
    setCloudsOn((on) => !on);
  };

  const windNote =
    mode === "radar" || windStatus.failed
      ? null
      : windStatus.loading
        ? "Loading wind…"
        : windCaption(mode, windStatus.time, windStatus.coarse);

  return (
    <div className="flex flex-col gap-3">
      <div className="map-toolbar">
        <div className="map-toolbar-controls">
          <MapLayerToggle mode={mode} onChange={selectMode} />
          <button
            type="button"
            aria-pressed={cloudsOn}
            onClick={toggleClouds}
            className={`map-clouds-toggle ${cloudsOn ? "unit-active" : "unit-inactive"}`}
          >
            Clouds
          </button>
        </div>
        {windNote && (
          <div className="map-toolbar-note">
            {!windStatus.loading && (
              <p
                className="wind-legend"
                aria-label={`Wind speed. Blue is calm, orange is ${displaySpeed(30, unit)} ${windUnitLabel(unit)} or more.`}
              >
                <span>Slow</span>
                <span className="wind-legend-bar" />
                <span>Fast</span>
              </p>
            )}
            <p className="wind-caption">
              {windNote}
              {windStatus.speedMs != null &&
                ` · ${displaySpeed(windStatus.speedMs, unit)} ${windUnitLabel(unit)} in view`}
            </p>
          </div>
        )}
      </div>
      <div className="radar-stage">
        <div
          ref={containerRef}
          aria-label={mapLabel(mode)}
          className="h-full w-full"
        />
        {mapInstance && mode !== "radar" && (
          <WindOverlay
            map={mapInstance}
            onError={setWindError}
            onStatus={setWindStatus}
          />
        )}
      </div>
      {error ? (
        <p role="alert" className="banner-error" style={{ margin: 0 }}>
          {error}
        </p>
      ) : mode !== "wind" ? (
        <RadarTimeline
          frames={frames}
          current={current}
          playing={playing}
          onScrub={setCurrent}
          onTogglePlay={() => setPlaying((p) => !p)}
        />
      ) : null}
      {cloudsOn && cloudTime && (
        <p className="wind-caption" style={{ margin: 0 }}>
          {cloudCaption(cloudTime)}
        </p>
      )}
      {cloudError && (
        <p role="alert" className="banner-error" style={{ margin: 0 }}>
          {cloudError}
        </p>
      )}
      {windError && (
        <p role="alert" className="banner-error" style={{ margin: 0 }}>
          {windError}
        </p>
      )}
    </div>
  );
}
