import Colophon from "./Colophon";

const SOURCES = [
  { label: "Open-Meteo", href: "https://open-meteo.com/" },
  { label: "RainViewer", href: "https://www.rainviewer.com/" },
  {
    label: "OpenStreetMap",
    href: "https://www.openstreetmap.org/copyright",
  },
] as const;

export default function Footer() {
  return (
    <footer className="site-footer">
      <span className="footer-brand">Mondaugen</span>
      <Colophon />
      <p>
        Data from{" "}
        {SOURCES.map((source, i) => (
          <span key={source.href}>
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {source.label}
            </a>
            {i < SOURCES.length - 2 ? ", " : ""}
            {i === SOURCES.length - 2 ? " and " : ""}
          </span>
        ))}
        . Ad-free · tracker-free.
      </p>
    </footer>
  );
}
