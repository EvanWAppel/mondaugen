"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  boundsKey,
  fetchWindField,
  flowDt,
  formatWindTime,
  gridForBounds,
  quantizeBounds,
  sample,
  speedColor,
  stepParticle,
  typicalSpeedMs,
  type Bounds,
  type LngLat,
  type WindField,
} from "@/lib/wind";
import type { MapLayerMode } from "./MapLayerToggle";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOVE_DEBOUNCE_MS = 400;
const TRAIL_MIN = 3;
const TRAIL_MAX = 7;

interface Particle extends LngLat {
  trail: LngLat[];
}

export interface WindStatus {
  loading: boolean;
  failed: boolean;
  coarse: boolean;
  time: string | null;
  /** Median speed in the current view, m/s. Null while loading or on failure. */
  speedMs: number | null;
}

interface WindOverlayProps {
  map: MapLibreMap;
  onError: (message: string | null) => void;
  onStatus: (status: WindStatus) => void;
}

export function windCaption(
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

function speedAmount(speedMs: number): number {
  return Math.max(0, Math.min(1, speedMs / 30));
}

/** Shorter, thinner strokes when the wind is light. */
function strokeColored(ctx: CanvasRenderingContext2D, color: string, speedMs: number) {
  const width = 0.9 + speedAmount(speedMs) * 0.9;
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "rgba(7, 11, 18, 0.4)";
  ctx.lineWidth = width + 1.1;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
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
  const count = width > 0 && width < 600 ? 160 : 280;
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
      const speed = Math.hypot(wind.u, wind.v);
      const start = projectPoint(map, origin);
      if (start.x < -20 || start.y < -20 || start.x > width + 20 || start.y > height + 20) {
        continue;
      }
      const tipGeo = stepParticle(origin, field, 1);
      const tip = projectPoint(map, tipGeo);
      const dx = tip.x - start.x;
      const dy = tip.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const arrowPx = 8 + speedAmount(speed) * 14;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(start.x + (dx / length) * arrowPx, start.y + (dy / length) * arrowPx);
      strokeColored(ctx, speedColor(speed), speed);
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
  ctx.lineCap = "round";
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
    const speed = Math.hypot(wind.u, wind.v);
    particle.trail.push({
      longitude: particle.longitude,
      latitude: particle.latitude,
    });
    const trailLength =
      TRAIL_MIN + Math.round(speedAmount(speed) * (TRAIL_MAX - TRAIL_MIN));
    while (particle.trail.length > trailLength) particle.trail.shift();
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
    strokeColored(ctx, speedColor(speed), speed);
  }
}

export default function WindOverlay({ map, onError, onStatus }: WindOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<WindField | null>(null);
  const reduced = usePrefersReducedMotion();
  const [fieldTick, setFieldTick] = useState(0);
  const [pageHidden, setPageHidden] = useState(false);

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

    const publish = (next: WindStatus) => {
      onStatus(next);
    };

    const apply = (field: WindField) => {
      fieldRef.current = field;
      setFieldTick((tick) => tick + 1);
      publish({
        loading: false,
        failed: false,
        coarse: field.coarse,
        time: field.time,
        speedMs: typicalSpeedMs(field),
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
      publish({ loading: true, failed: false, coarse: false, time: null, speedMs: null });
      fetchWindField(gridForBounds(snapped), { signal })
        .then((field) => {
          if (cancelled || signal.aborted) return;
          cache.set(key, field);
          apply(field);
        })
        .catch((err: unknown) => {
          if (cancelled || signal.aborted) return;
          fieldRef.current = null;
          publish({
            loading: false,
            failed: true,
            coarse: false,
            time: null,
            speedMs: null,
          });
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
  }, [map, onError, onStatus]);

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
    </div>
  );
}
