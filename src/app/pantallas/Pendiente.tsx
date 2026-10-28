import { useParams } from "react-router";

/** Marcador para las rutas que aún no se construyen. */
export function Pendiente({ nombre }: { nombre: string }) {
  const params = useParams();
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl text-primary">{nombre}</h1>
      <pre className="mt-4 rounded-lg bg-muted p-3 text-sm">{JSON.stringify(params, null, 2)}</pre>
    </main>
  );
}
