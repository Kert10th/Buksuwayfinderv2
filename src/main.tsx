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

createRoot(document.getElementById("root")!).render(<App />);
