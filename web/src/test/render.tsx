/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/** A fresh QueryClient per render so cache state never leaks across tests. */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const client = makeClient();
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** Drop-in replacement for @testing-library/react's `render` that wraps the
 *  component in a fresh QueryClientProvider. Use this in any test that
 *  renders a component consuming a TanStack Query hook. */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from RTL so test files can import from a single place.
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
