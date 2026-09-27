import { useSyncExternalStore } from "react";
import type { TemperatureUnit } from "./forecast";
import { readStored } from "./storage";

const STORAGE_KEY = "mondaugen:temperature-unit";

/** Imperial default for a US-facing portfolio (PRD §5). */
export const DEFAULT_UNIT: TemperatureUnit = "fahrenheit";

let current: TemperatureUnit | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): TemperatureUnit | null {
  if (typeof window === "undefined") return null;
  const raw = readStored(STORAGE_KEY);
  return raw === "fahrenheit" || raw === "celsius" ? raw : null;
}

function getSnapshot(): TemperatureUnit {
  if (!hydrated && typeof window !== "undefined") {
    current = readStorage();
    hydrated = true;
  }
  return current ?? DEFAULT_UNIT;
}

function getServerSnapshot(): TemperatureUnit {
  return DEFAULT_UNIT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Set + persist the temperature unit, notifying subscribers. */
export function setUnit(unit: TemperatureUnit): void {
  current = unit;
  hydrated = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, unit);
  }
  listeners.forEach((listener) => listener());
}

/** Persisted temperature unit, SSR-safe (server renders the default). */
export function useUnit(): [TemperatureUnit, (unit: TemperatureUnit) => void] {
  const unit = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [unit, setUnit];
}
