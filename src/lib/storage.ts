/**
 * Read a localStorage value. If the Mondaugen key is empty and the pre-rename
 * `weather:` key has a value, copy it forward once and drop the old key.
 */
export function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(key);
  if (current != null) return current;
  if (!key.startsWith("mondaugen:")) return null;
  const legacy = `weather:${key.slice("mondaugen:".length)}`;
  const old = window.localStorage.getItem(legacy);
  if (old == null) return null;
  try {
    window.localStorage.setItem(key, old);
    window.localStorage.removeItem(legacy);
  } catch {
    // Private mode or a full disk — still honor the old value.
  }
  return old;
}
