export default function App() {
  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="surface p-10 max-w-xl">
        <p className="label-upper mb-2">Satellite Visibility</p>
        <h1 className="font-serif italic text-3xl mb-3">
          A bright pass, low to the south.
        </h1>
        <p className="text-fg-muted">
          Scaffold is alive. Tailwind, theme tokens, and the Cosmic Editorial
          palette are wired up.
        </p>
        <div className="mt-6 flex gap-3">
          <span className="h-3 w-3 rounded-full bg-satellite shadow-glow" />
          <span className="h-3 w-3 rounded-full bg-observer" />
          <span className="h-3 w-3 rounded-full bg-success" />
          <span className="h-3 w-3 rounded-full bg-danger" />
        </div>
      </div>
    </main>
  );
}
