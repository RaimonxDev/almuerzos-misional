import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { ErrorApi } from "./api";
import { ProveedorIdioma } from "./i18n";
import { Toaster } from "./components/ui/sonner";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 404 o un 403 no se arregla reintentando; un corte de red, quizás sí.
      retry: (intentos, error) => !(error instanceof ErrorApi && error.status >= 400 && error.status < 500) && intentos < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProveedorIdioma>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </ProveedorIdioma>
    </QueryClientProvider>
  </StrictMode>,
);
