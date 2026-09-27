import { useSyncExternalStore } from "react";
import { readStored } from "./storage";
import type { Location } from "./types";

const STORAGE_KEY = "mondaugen:active-location";

/** Shown on first visit before the user picks anything (FR-3). */
export const DEFAULT_LOCATION: Location = {
  id: 5128581,
  name: "New York",
  latitude: 40.7128,
  longitude: -74.006,
  country: "United States",
  admin1: "New York",
  timezone: "America/New_York",
};

let current: Location | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): Location | null {
  if (typeof window === "undefined") return null;
  const raw = readStored(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Location>;
    if (
      typeof parsed?.latitude === "number" &&
      typeof parsed?.longitude === "number" &&
      typeof parsed?.name === "string"
    ) {
      return parsed as Location;
    }
  } catch {
    // Corrupt value — fall back to the default below.
  }
  return null;
}

function getSnapshot(): Location {
  if (!hydrated && typeof window !== "undefined") {
    current = readStorage();
    hydrated = true;
  }
  return current ?? DEFAULT_LOCATION;
}

function getServerSnapshot(): Location {
  return DEFAULT_LOCATION;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current active location without subscribing (SSR-safe imperative read). */
export function readActiveLocation(): Location {
  return getSnapshot();
}

/** Set + persist the active location, notifying subscribers. */
export function setActiveLocation(location: Location): void {
  current = location;
  hydrated = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  }
  listeners.forEach((listener) => listener());
}

/**
 * Active location, persisted to localStorage. Uses useSyncExternalStore so the
 * server renders the default and the client rehydrates from storage without a
 * hydration mismatch (FR-3).
 */
export function useActiveLocation(): [Location, (location: Location) => void] {
  const location = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return [location, setActiveLocation];
}
