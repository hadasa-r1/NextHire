import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

// Shared design system — tokens first, then the component styles that use them.
import "@ds/tokens.css";
import "@ds/components.css";

import { router } from "@/router";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html is missing <div id="root">.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
