import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { ProveedorIdioma } from "./i18n";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProveedorIdioma>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </ProveedorIdioma>
  </StrictMode>,
);
