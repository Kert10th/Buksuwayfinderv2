import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// In production (Cloudflare Pages), silence console.log spam from debug code
// that piles up on long-running kiosks. Keep warn/error so real issues surface.
if (import.meta.env.PROD) {
  // eslint-disable-next-line no-console
  console.log = () => {};
  // eslint-disable-next-line no-console
  console.debug = () => {};
}

// Kiosk-safe browser behavior. These global handlers harden the app for
// unattended touchscreen use without breaking form inputs or the map's
// own right-click / gesture features.
if (typeof window !== 'undefined') {
  // 1. Suppress the browser right-click menu on idle surfaces. Form inputs
  //    (so paste works for admins) and elements inside the map container
  //    (which already uses contextmenu for undo in drawing mode) are exempt.
  window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (target.closest('[data-kiosk-map]')) return; // map handles its own right-click
    e.preventDefault();
  });

  // 2. Block the two-finger / double-tap pinch-zoom on iOS Safari. The
  //    viewport meta tag handles most browsers but iOS needs these events
  //    cancelled explicitly.
  const preventGesture = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', preventGesture);
  document.addEventListener('gesturechange', preventGesture);
  document.addEventListener('gestureend', preventGesture);

  // 3. Stop accidental double-tap zoom (also mainly iOS Safari).
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

createRoot(document.getElementById("root")!).render(<App />);
