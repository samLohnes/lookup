import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// cmdk uses ResizeObserver internally; jsdom doesn't provide it.
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Vitest's jsdom environment exposes localStorage as a plain `{}` without
// Web Storage API methods. Install a minimal in-memory implementation so
// Zustand's `persist` middleware can call getItem/setItem/removeItem.
const _inMemoryStorage = (() => {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  } as Storage;
})();

Object.defineProperty(window, "localStorage", {
  value: _inMemoryStorage,
  writable: true,
  configurable: true,
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
