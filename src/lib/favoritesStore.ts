import { useSyncExternalStore } from "react";
import type { Location } from "./types";

const STORAGE_KEY = "weather:favorites";

/**
 * Stable identity for a favorite. Geolocation-derived locations synthesize an
 * `id`, so we key on rounded coordinates instead — close enough that the same
 * place doesn't get saved twice.
 */
export function favoriteKey(
  loc: Pick<Location, "latitude" | "longitude">,
): string {
  return `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`;
}

const EMPTY: Location[] = [];

let favorites: Location[] | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): Location[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (l): l is Location =>
          l &&
          typeof l.latitude === "number" &&
          typeof l.longitude === "number" &&
          typeof l.name === "string",
      );
    }
  } catch {
    // Corrupt value — treat as no favorites.
  }
  return EMPTY;
}

function getSnapshot(): Location[] {
  if (!hydrated && typeof window !== "undefined") {
    favorites = readStorage();
    hydrated = true;
  }
  return favorites ?? EMPTY;
}

function getServerSnapshot(): Location[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function persist(next: Location[]): void {
  favorites = next;
  hydrated = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

export function readFavorites(): Location[] {
  return getSnapshot();
}

export function isFavorite(loc: Location): boolean {
  const key = favoriteKey(loc);
  return getSnapshot().some((f) => favoriteKey(f) === key);
}

export function addFavorite(loc: Location): void {
  const key = favoriteKey(loc);
  const current = getSnapshot();
  if (current.some((f) => favoriteKey(f) === key)) return;
  persist([...current, loc]);
}

export function removeFavorite(loc: Location): void {
  const key = favoriteKey(loc);
  persist(getSnapshot().filter((f) => favoriteKey(f) !== key));
}

export function toggleFavorite(loc: Location): void {
  if (isFavorite(loc)) removeFavorite(loc);
  else addFavorite(loc);
}

/** Favorite locations, persisted to localStorage (no account, no server sync). */
export function useFavorites(): Location[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
