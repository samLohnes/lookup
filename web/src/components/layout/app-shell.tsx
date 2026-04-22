import type { ReactNode } from "react";

interface Props {
  left: ReactNode;
  main: ReactNode;
  side: ReactNode;
}

export function AppShell({ left, main, side }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6 lg:grid-cols-[320px_1fr_360px]">
      <aside className="space-y-4">{left}</aside>
      <section className="space-y-4">{main}</section>
      <aside className="space-y-4">{side}</aside>
    </div>
  );
}
