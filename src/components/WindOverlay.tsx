"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useUnit } from "@/lib/unitStore";
import {
  boundsKey,
  displaySpeed,
  fetchWindField,
  flowDt,
  formatWindTime,
  gridForBounds,
  quantizeBounds,
  sample,
  speedColor,
  stepParticle,
  windUnitLabel,
  type Bounds,
  type LngLat,
  type WindField,
} from "@/lib/wind";
import type { MapLayerMode } from "./MapLayerToggle";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOVE_DEBOUNCE_MS = 400;
const TRAIL_LENGTH = 10;
const ARROW_PX = 18;

interface Particle extends LngLat {
  trail: LngLat[];
}

interface WindOverlayProps {
  map: MapLibreMap;
  mode: Extract<MapLayerMode, "wind" | "both">;
  onError: (message: string | null) => void;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(REDUCED_MOTION_QUERY);
      if (!mq) return () => {};
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false,
    () => false,
  );
}

function readBounds(map: MapLibreMap): Bounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function spawn(field: WindField): LngLat | null {
  const west = field.longitudes[0];
  const east = field.longitudes[field.longitudes.length - 1];
  const south = field.latitudes[0];
  const north = field.latitudes[field.latitudes.length - 1];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const point = {
      longitude: west + Math.random() * (east - west),
      latitude: south + Math.random() * (north - south),
    };
    if (!sample(field, point.longitude, point.latitude)) continue;
    const turns = Math.floor((point.longitude + 180) / 360);
    return { ...point, longitude: point.longitude - turns * 360 };
  }
  return null;
}

function seedParticles(field: WindField, width: number): Particle[] {
  const count = width > 0 && width < 600 ? 400 : 800;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    const point = spawn(field);
    if (point) particles.push({ ...point, trail: [] });
  }
  return particles;
}

function resizeCanvas(canvas: HTMLCanvasElement): {
  dpr: number;
  width: number;
  height: number;
} {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  return { dpr, width, height };
}

function projectPoint(map: MapLibreMap, point: LngLat): { x: number; y: number } {
  return map.project([point.longitude, point.latitude]);
}

function drawArrows(
  ctx: CanvasRenderingContext2D,
  field: WindField,
  map: MapLibreMap,
  width: number,
  height: number,
) {
  const colStride = Math.max(1, Math.ceil(field.longitudes.length / 10));
  const rowStride = Math.max(1, Math.ceil(field.latitudes.length / 8));
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let row = 0; row < field.latitudes.length; row += rowStride) {
    for (let col = 0; col < field.longitudes.length; col += colStride) {
      const turns = Math.floor((field.longitudes[col] + 180) / 360);
      const origin = {
        longitude: field.longitudes[col] - turns * 360,
        latitude: field.latitudes[row],
      };
      const wind = sample(field, origin.longitude, origin.latitude);
      if (!wind) continue;
      const start = projectPoint(map, origin);
      if (start.x < -20 || start.y < -20 || start.x > width + 20 || start.y > height + 20) {
        continue;
      }
      const tipGeo = stepParticle(origin, field, 1);
      const tip = projectPoint(map, tipGeo);
      const dx = tip.x - start.x;
      const dy = tip.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(start.x + (dx / length) * ARROW_PX, start.y + (dy / length) * ARROW_PX);
      ctx.strokeStyle = speedColor(Math.hypot(wind.u, wind.v));
      ctx.stroke();
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  field: WindField,
  map: MapLibreMap,
  dt: number,
) {
  const zoom = map.getZoom();
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.9;
  for (const particle of particles) {
    const wind = sample(field, particle.longitude, particle.latitude);
    if (!wind) {
      const next = spawn(field);
      if (next) {
        particle.longitude = next.longitude;
        particle.latitude = next.latitude;
      }
      particle.trail = [];
      continue;
    }
    particle.trail.push({
      longitude: particle.longitude,
      latitude: particle.latitude,
    });
    if (particle.trail.length > TRAIL_LENGTH) particle.trail.shift();
    const stepped = stepParticle(
      particle,
      field,
      flowDt(zoom, particle.latitude, dt),
    );
    if (!sample(field, stepped.longitude, stepped.latitude)) {
      const next = spawn(field);
      if (next) {
        particle.longitude = next.longitude;
        particle.latitude = next.latitude;
      }
      particle.trail = [];
      continue;
    }
    particle.longitude = stepped.longitude;
    particle.latitude = stepped.latitude;

    ctx.beginPath();
    particle.trail.forEach((point, index) => {
      const projected = projectPoint(map, point);
      if (index === 0) ctx.moveTo(projected.x, projected.y);
      else ctx.lineTo(projected.x, projected.y);
    });
    const head = projectPoint(map, particle);
    ctx.lineTo(head.x, head.y);
    ctx.strokeStyle = speedColor(Math.hypot(wind.u, wind.v));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function caption(
  mode: Extract<MapLayerMode, "wind" | "both">,
  time: string | null,
  coarse: boolean,
): string {
  const parts = ["Wind now"];
  const when = formatWindTime(time);
  if (when) parts.push(when);
  if (coarse) parts.push("zoom in for a finer view");
  if (mode === "both") parts.push("scrubber moves precipitation only");
  return parts.join(" · ");
}

export default function WindOverlay({ map, mode, onError }: WindOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<WindField | null>(null);
  const reduced = usePrefersReducedMotion();
  const [unit] = useUnit();
  const [fieldTick, setFieldTick] = useState(0);
  const [pageHidden, setPageHidden] = useState(false);
  const [status, setStatus] = useState({
    loading: true,
    failed: false,
    coarse: false,
    time: null as string | null,
  });

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const cache = new Map<string, WindField>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let cancelled = false;
    let loadedOnce = false;

    const apply = (field: WindField) => {
      fieldRef.current = field;
      setFieldTick((tick) => tick + 1);
      setStatus({
        loading: false,
        failed: false,
        coarse: field.coarse,
        time: field.time,
      });
      onError(null);
    };

    const load = () => {
      if (!map.isStyleLoaded()) return;
      const snapped = quantizeBounds(readBounds(map));
      const key = boundsKey(snapped);
      const cached = cache.get(key);
      if (cached) {
        apply(cached);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      setStatus((current) => ({ ...current, loading: true, failed: false }));
      fetchWindField(gridForBounds(snapped), { signal })
        .then((field) => {
          if (cancelled || signal.aborted) return;
          cache.set(key, field);
          apply(field);
        })
        .catch((err: unknown) => {
          if (cancelled || signal.aborted) return;
          fieldRef.current = null;
          setStatus({ loading: false, failed: true, coarse: false, time: null });
          onError(
            err instanceof Error ? err.message : "Couldn't load wind.",
          );
        });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, MOVE_DEBOUNCE_MS);
    };

    const start = () => {
      if (loadedOnce) schedule();
      else {
        loadedOnce = true;
        load();
      }
    };

    if (map.isStyleLoaded()) start();
    else map.once("load", start);
    map.on("moveend", schedule);

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
      map.off("moveend", schedule);
      map.off("load", start);
      onError(null);
    };
  }, [map, onError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    if (!canvas || !field || pageHidden) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (reduced) {
      const drawStill = () => {
        const { dpr, width, height } = resizeCanvas(canvas);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        drawArrows(ctx, field, map, width, height);
      };
      drawStill();
      map.on("move", drawStill);
      return () => {
        map.off("move", drawStill);
      };
    }

    const particles = seedParticles(field, canvas.clientWidth);
    let raf = 0;
    let last = 0;
    let stopped = false;
    const loop = (now: number) => {
      if (stopped) return;
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const view = resizeCanvas(canvas);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, view.width, view.height);
      // Trails live in lng/lat and are reprojected every frame. A fading
      // screen-space buffer would smear as soon as the map moves.
      drawParticles(ctx, particles, field, map, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [map, reduced, fieldTick, pageHidden]);

  return (
    <div className="wind-overlay">
      <canvas ref={canvasRef} className="wind-canvas" aria-hidden="true" />
      <div className="wind-readout">
        {!status.loading && !status.failed && (
          <p className="wind-legend">
            <span>calm</span>
            <span className="wind-legend-bar" />
            <span>
              {displaySpeed(30, unit)} {windUnitLabel(unit)}
            </span>
          </p>
        )}
        {!status.failed && (
          <p className="wind-caption">
            {status.loading
              ? "Loading wind…"
              : caption(mode, status.time, status.coarse)}
          </p>
        )}
      </div>
    </div>
  );
}
