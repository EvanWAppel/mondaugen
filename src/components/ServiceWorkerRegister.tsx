"use client";

import { useEffect } from "react";

/** Registers the service worker in production for the installable/offline PWA
 *  (NFR-7). No-op in dev and where service workers aren't supported. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is best-effort; the app works without it.
    });
  }, []);
  return null;
}
