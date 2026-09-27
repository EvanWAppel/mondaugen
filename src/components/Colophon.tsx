"use client";

import { useRef, useState } from "react";
import { useDialogA11y } from "@/lib/useDialogA11y";

const SOURCES = [
  {
    label: "Open-Meteo",
    href: "https://open-meteo.com/",
    role: "forecast, geocoding, and wind",
  },
  {
    label: "RainViewer",
    href: "https://www.rainviewer.com/",
    role: "radar tiles",
  },
  {
    label: "MapLibre GL + OpenStreetMap",
    href: "https://maplibre.org/",
    role: "base map",
  },
];

/** In-app "How it's built" panel (FR-14): the keyless, ad-free story. */
export default function Colophon() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="footer-link" onClick={() => setOpen(true)}>
        How it&rsquo;s built
      </button>
      {open && <ColophonDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ColophonDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  return (
    <div className="palette-backdrop" onMouseDown={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="colophon glass"
        role="dialog"
        aria-modal="true"
        aria-label="How it's built"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="colophon-head">
          <h2>How it&rsquo;s built</h2>
          <button
            type="button"
            className="colophon-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p>
          <strong>Mondaugen</strong> is a personal weather app — a calm, ad-free
          take on the two things a weather site is actually for: the 10-day
          forecast and the radar. The backdrop reacts to the current conditions
          and the time of day.
        </p>

        <p className="colophon-label">Keyless by design</p>
        <p>
          Every data source is public and free — no API keys, no secrets, nothing
          billed to anyone.
        </p>
        <ul className="colophon-sources">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
              <span>{s.role}</span>
            </li>
          ))}
        </ul>

        <p className="colophon-foot">
          Next.js + TypeScript on Vercel. No ads, no third-party trackers, no
          account.
        </p>
      </div>
    </div>
  );
}
