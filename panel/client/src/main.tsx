import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

/* Aether core fingerprint — survives custom branding. */
console.log(
  "%c AETHER PANEL %c github.com/Yun0-vibe/aether-panel · game servers, handled ",
  `background:linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7);color:#04121c;font-weight:800;font-family:Inter,sans-serif;border-radius:4px 0 0 4px;padding:3px 7px;`,
  "background:#0d1424;color:#67e8f9;font-family:JetBrains Mono,monospace;font-size:10px;border-radius:0 4px 4px 0;padding:3px 7px;",
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
