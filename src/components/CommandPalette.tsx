"use client";

import { useEffect, useRef, useState } from "react";
import { searchLocations } from "@/lib/geocoding";
import {
  favoriteKey,
  toggleFavorite,
  useFavorites,
} from "@/lib/favoritesStore";
import { useDialogA11y } from "@/lib/useDialogA11y";
import { locationLabel, type Location } from "@/lib/types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  activeLocation: Location;
}

const DEBOUNCE_MS = 250;

/**
 * ⌘K / Ctrl-K command palette (FR-11): search + switch locations and jump to
 * favorites. Keyboard-first — arrows to move, Enter to pick, Esc to close.
 */
export default function CommandPalette({
  open,
  onClose,
  onSelect,
  activeLocation,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const favorites = useFavorites();

  // The visible, selectable list: search results when querying, else favorites.
  const items = query.trim() ? results : favorites;

  // Focus in, trap Tab, Escape to close, restore focus to the opener on close.
  useDialogA11y(dialogRef, onClose);

  // Debounced geocoding search (mirrors LocationSearch; errors surface, FR-6).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!q) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const found = await searchLocations(q, { signal: controller.signal });
        setResults(found);
        setHighlight(0);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  function choose(location: Location) {
    onSelect(location);
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, items.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = items[highlight];
      if (chosen) choose(chosen);
    }
  }

  return (
    <div
      className="palette-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="palette glass"
        role="dialog"
        aria-modal="true"
        aria-label="Search locations"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-input">
          <span aria-hidden="true" className="search-icon">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city, or pick a favorite…"
            aria-label="Search a city"
            autoComplete="off"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <ul className="palette-list" role="listbox" aria-label="Locations">
          {loading && <li className="palette-note">Searching…</li>}
          {error && !loading && (
            <li className="palette-note" style={{ color: "var(--danger)" }}>
              {error}
            </li>
          )}
          {!loading && !error && items.length === 0 && (
            <li className="palette-note">
              {query.trim()
                ? "No matches."
                : favorites.length === 0
                  ? "No favorites yet — search, then tap ★ to save one."
                  : "Type to search."}
            </li>
          )}
          {!loading &&
            !error &&
            items.map((location, i) => {
              const key = favoriteKey(location);
              const isActive = key === favoriteKey(activeLocation);
              const saved = favorites.some((f) => favoriteKey(f) === key);
              return (
                <li
                  key={`${key}-${location.id}`}
                  className={i === highlight ? "palette-item active" : "palette-item"}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className="palette-choose"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(location)}
                  >
                    <span>{locationLabel(location)}</span>
                    {isActive && <span className="palette-tag">current</span>}
                  </button>
                  <button
                    type="button"
                    className={saved ? "palette-star saved" : "palette-star"}
                    aria-label={saved ? "Remove favorite" : "Save favorite"}
                    aria-pressed={saved}
                    onClick={() => toggleFavorite(location)}
                  >
                    {saved ? "★" : "☆"}
                  </button>
                </li>
              );
            })}
        </ul>

        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>★</kbd> favorite</span>
        </div>
      </div>
    </div>
  );
}
