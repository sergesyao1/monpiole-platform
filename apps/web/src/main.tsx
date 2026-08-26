import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.js";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("La racine de l'application est introuvable.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
