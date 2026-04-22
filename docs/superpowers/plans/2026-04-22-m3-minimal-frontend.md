# M3 — Minimal Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, locally-run React frontend that lets the user pick an observer location (map + address + saved spots), search for a satellite, choose a time window, and see the resulting passes as both a list / timeline and an SVG sky view — all talking to the M2 FastAPI backend. No 3D earth yet; that's M4.

**Architecture:** Vite + React + TypeScript app in `web/` at project root. Tailwind + shadcn/ui primitives built atomically (feature folders under `components/`). TanStack Query handles server state; Zustand (~3 KB) handles client UI state including the selected observer/satellite/pass. Vite dev server proxies `/api/*` to `http://127.0.0.1:8765` so the browser never sees cross-origin. Saved locations persist via `localStorage`. Sky view is SVG, alt-azimuth projection.

**Tech Stack:** React 19, Vite 6, TypeScript 5, Tailwind CSS 4, shadcn/ui, Leaflet + OpenStreetMap, Zustand 5, TanStack Query 5, Vitest + React Testing Library + MSW for tests, OSM Nominatim for geocoding. One tiny FastAPI addition: `GET /catalog/search` — a zero-cost catalog fuzzy-search endpoint.

---

## File Structure

```
web/
├── .gitignore                         # node_modules, dist
├── package.json
├── pnpm-lock.yaml | package-lock.json
├── vite.config.ts                     # proxy /api → 127.0.0.1:8765
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.app.json
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── eslint.config.js
├── components.json                    # shadcn config
├── src/
│   ├── main.tsx                       # React entry, mounts <App />
│   ├── App.tsx                        # top-level layout
│   ├── index.css                      # Tailwind directives + theme tokens
│   ├── lib/
│   │   ├── api.ts                     # typed fetch wrapper
│   │   ├── query-client.ts            # TanStack Query setup
│   │   └── utils.ts                   # cn() helper
│   ├── types/
│   │   └── api.ts                     # TS mirrors of api/schemas/responses.py
│   ├── store/
│   │   ├── observer.ts                # lat/lng/elevation, saved locations
│   │   ├── satellite.ts               # current sat query + resolved name
│   │   ├── time-range.ts              # from/to UTC
│   │   └── selection.ts               # selected pass id
│   ├── hooks/
│   │   ├── use-passes.ts
│   │   ├── use-sky-track.ts
│   │   ├── use-horizon.ts
│   │   ├── use-tle-freshness.ts
│   │   ├── use-catalog-search.ts
│   │   └── use-geocode.ts             # Nominatim wrapper
│   ├── components/
│   │   ├── ui/                        # shadcn primitives (copy-pasted, editable)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── command.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── popover.tsx
│   │   │   └── skeleton.tsx
│   │   ├── layout/
│   │   │   ├── app-shell.tsx          # grid layout
│   │   │   └── header.tsx             # brand + TLE freshness indicator
│   │   ├── observer/
│   │   │   ├── observer-panel.tsx     # composes address + map + saved
│   │   │   ├── address-search.tsx
│   │   │   ├── map-picker.tsx         # Leaflet
│   │   │   └── saved-locations.tsx
│   │   ├── satellite/
│   │   │   └── satellite-search.tsx   # Command menu
│   │   ├── time/
│   │   │   └── time-range-picker.tsx
│   │   ├── passes/
│   │   │   ├── pass-list.tsx
│   │   │   ├── pass-card.tsx
│   │   │   └── timeline-strip.tsx     # horizontal SVG strip
│   │   └── sky-view/
│   │       ├── sky-view.tsx           # composes subcomponents
│   │       ├── dome.tsx               # circle + elevation rings
│   │       ├── compass.tsx            # N/E/S/W + tick marks
│   │       ├── horizon-silhouette.tsx # terrain mask as filled path
│   │       └── satellite-arc.tsx      # pass track
│   └── test/
│       ├── setup.ts                   # vitest + @testing-library/jest-dom
│       └── msw/
│           └── handlers.ts            # MSW API mocks
└── public/
    └── favicon.ico

# Backend additions for M3:
api/routes/catalog.py                  # GET /catalog/search — fuzzy search only
tests/api_unit/test_catalog_route.py

# Repo-level:
Justfile                               # add web + web-build recipes
README.md                              # add frontend run instructions
```

---

## Conventions for this plan

- **Each code step shows complete file contents**, not a diff. Tasks are safe to execute out of order this way.
- **Tests use `just`:** `just test` for Python, `just web-test` for frontend (added in Task 0). No raw `pytest` / `vitest` calls needed.
- **Commit messages:** brief, single-line conventional commits. No body, no co-author trailer.
- **One commit per task** minimum; the final step of each task commits.
- **Vite dev proxy:** `/api/*` → `http://127.0.0.1:8765/*` (with `/api` prefix stripped). Frontend calls `fetch('/api/passes', …)`; backend sees `POST /passes`. No CORS.

---

## Task 0: Backend — `GET /catalog/search` endpoint

Before we can build a responsive satellite search in the frontend, the backend needs an endpoint that does fuzzy catalog lookup *without* fetching TLEs (which is slow and wasteful for per-keystroke search). This is a tiny addition to M2.

**Files:**
- Create: `api/routes/catalog.py`
- Modify: `api/app.py`
- Create: `tests/api_unit/test_catalog_route.py`
- Modify: `api/schemas/responses.py` (add `CatalogHitResponse`)

- [ ] **Step 1: Add response schema**

Append to `api/schemas/responses.py`:

```python
class CatalogHitResponse(BaseModel):
    display_name: str
    match_type: Literal["satellite", "group"]
    norad_ids: list[int]
    score: float
```

- [ ] **Step 2: Write the failing test**

Create `tests/api_unit/test_catalog_route.py`:

```python
"""Tests for GET /catalog/search."""
from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


def _client() -> TestClient:
    app = create_app(Settings(cache_root="/tmp/satvis-test"))
    return TestClient(app)


def test_catalog_search_returns_iss_for_iss_query():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "iss"})
    assert r.status_code == 200
    hits = r.json()
    assert hits, "expected at least one hit"
    assert hits[0]["display_name"] == "ISS (ZARYA)"
    assert hits[0]["match_type"] == "satellite"
    assert 25544 in hits[0]["norad_ids"]


def test_catalog_search_returns_group_for_starlink_query():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "starlink"})
    assert r.status_code == 200
    hits = r.json()
    assert any(h["match_type"] == "group" and h["display_name"] == "starlink" for h in hits)


def test_catalog_search_empty_query_returns_empty_list():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": ""})
    # FastAPI rejects the empty param via the Query min_length constraint (422),
    # OR we return []. Pick the 422 path — cleaner contract.
    assert r.status_code == 422


def test_catalog_search_no_match_returns_empty_list():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "ZZZNOMATCH12345"})
    assert r.status_code == 200
    assert r.json() == []


def test_catalog_search_respects_limit():
    with _client() as c:
        r = c.get("/catalog/search", params={"q": "s", "limit": 3})
    assert r.status_code == 200
    assert len(r.json()) <= 3
```

- [ ] **Step 3: Run — expect ImportError**

```bash
just test-one tests/api_unit/test_catalog_route.py
```

Expected: fails because `api.routes.catalog` doesn't exist.

- [ ] **Step 4: Implement `api/routes/catalog.py`**

```python
"""GET /catalog/search — fuzzy satellite lookup, no TLE fetching."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from api.schemas.responses import CatalogHitResponse
from core.catalog.search import DEFAULT_CATALOG, fuzzy_search

router = APIRouter()


@router.get("/catalog/search", response_model=list[CatalogHitResponse])
def get_catalog_search(
    q: Annotated[str, Query(min_length=1, description="Free-text query")],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[CatalogHitResponse]:
    hits = fuzzy_search(q, catalog=DEFAULT_CATALOG, limit=limit)
    return [
        CatalogHitResponse(
            display_name=h.display_name,
            match_type=h.match_type,
            norad_ids=list(h.norad_ids),
            score=h.score,
        )
        for h in hits
    ]
```

- [ ] **Step 5: Register router in `api/app.py`**

Add the import + `include_router` line alongside the others:

```python
from api.routes.catalog import router as catalog_router
# ...
app.include_router(catalog_router)
```

- [ ] **Step 6: Run — should pass**

```bash
just test-one tests/api_unit/test_catalog_route.py
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add api/routes/catalog.py api/app.py api/schemas/responses.py tests/api_unit/test_catalog_route.py
git commit -m "feat(api): GET /catalog/search endpoint"
```

---

## Task 1: Vite + React + TS scaffold

**Files:**
- Create: `web/` (via scaffold command)
- Create: `web/.gitignore`
- Modify: `web/vite.config.ts` (add API proxy)
- Modify: `web/tsconfig.app.json` (path alias)
- Modify: root `Justfile` (add `web`, `web-build`, `web-test` recipes)
- Modify: root `.gitignore` (add `web/node_modules`, `web/dist`)

- [ ] **Step 1: Scaffold the Vite app**

From project root:

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install
```

This creates `web/package.json`, `web/src/App.tsx` etc with the default template.

- [ ] **Step 2: Replace `web/vite.config.ts`**

Overwrite with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: false,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
```

- [ ] **Step 3: Add path-alias + strict config to `web/tsconfig.app.json`**

Full contents (merge carefully — Vite's template already has most of this; ensure `paths` is present):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Append to the root `.gitignore`**

Add these lines at the bottom:

```
# Frontend
web/node_modules/
web/dist/
web/.vite/
```

- [ ] **Step 5: Overwrite `web/.gitignore`**

```
node_modules
dist
.vite
.vite-cache
*.local
```

- [ ] **Step 6: Add frontend recipes to the root `Justfile`**

Append at the bottom:

```
# Install frontend deps (runs npm install in web/).
web-install:
    cd web && npm install

# Start the Vite dev server on http://127.0.0.1:5173. Requires `just serve` in another shell.
web:
    cd web && npm run dev

# Production build of the frontend → web/dist.
web-build:
    cd web && npm run build

# Frontend unit + component tests via vitest.
web-test:
    cd web && npm run test -- --run

# Frontend tests in watch mode.
web-test-watch:
    cd web && npm run test

# Frontend ESLint.
web-lint:
    cd web && npm run lint
```

- [ ] **Step 7: Smoke test — verify the dev server starts**

From project root:

```bash
just web-install
just web &
SERVER=$!
sleep 4
curl -sf http://127.0.0.1:5173/ | head -5
kill $SERVER 2>/dev/null || true
wait $SERVER 2>/dev/null || true
```

Expected: prints the default Vite template HTML (starts with `<!doctype html>`).

- [ ] **Step 8: Commit**

```bash
git add web .gitignore Justfile
git commit -m "chore(web): Vite + React + TS scaffold"
```

---

## Task 2: Tailwind + design tokens (Cosmic Editorial theme)

**Files:**
- Modify: `web/package.json` (add tailwind deps)
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`
- Overwrite: `web/src/index.css`
- Overwrite: `web/src/App.tsx` (verify Tailwind works)

- [ ] **Step 1: Install Tailwind + autoprefixer**

```bash
cd web && npm install -D tailwindcss@^3.4 postcss@^8 autoprefixer@^10
```

Note: using Tailwind 3.x for shadcn compatibility; Tailwind 4 is newer but shadcn isn't fully migrated yet.

- [ ] **Step 2: Create `web/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Cosmic Editorial palette — deep space base + warm observer accent
        bg: {
          DEFAULT: "#05060a", // near-black page background
          raised: "#0a0c12", // panels
          overlay: "rgba(255,255,255,0.02)",
        },
        edge: {
          DEFAULT: "rgba(255,255,255,0.06)", // default border
          strong: "rgba(255,255,255,0.12)",
        },
        fg: {
          DEFAULT: "rgba(255,255,255,0.92)",
          muted: "rgba(255,255,255,0.5)",
          subtle: "rgba(255,255,255,0.3)",
        },
        // Functional accents — cool satellite track + warm observer pin
        satellite: "#9ec5ff",
        observer: "#ffb347",
        // Semantic
        danger: "#ff6b6b",
        success: "#6fcf97",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        serif: ["Georgia", "Times New Roman", "serif"],
        mono: ["SF Mono", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        // Tighter tracking for small-caps labels
        label: ["0.68rem", { letterSpacing: "0.18em" }],
      },
      borderRadius: {
        card: "12px",
        pill: "999px",
      },
      boxShadow: {
        halo: "0 0 40px rgba(158, 197, 255, 0.15)",
        glow: "0 0 12px rgba(158, 197, 255, 0.5)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create `web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Overwrite `web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    color-scheme: dark;
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-bg text-fg font-sans;
    min-height: 100dvh;
  }

  /* Small-caps label utility for the frequent "SATELLITE", "WINDOW" labels. */
  .label-upper {
    @apply text-label uppercase text-fg-muted;
  }

  /* Serif accent for headlines and editorial captions. */
  .serif-accent {
    @apply font-serif italic;
  }
}

@layer components {
  /* Card surface with subtle raised background + top highlight. */
  .surface {
    @apply bg-bg-raised border border-edge rounded-card;
  }
}
```

- [ ] **Step 5: Overwrite `web/src/App.tsx` with a theme smoke test**

```tsx
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
```

- [ ] **Step 6: Smoke test the dev server**

```bash
just web &
SERVER=$!
sleep 4
curl -sf http://127.0.0.1:5173/ | grep -q 'id="root"' && echo OK
kill $SERVER 2>/dev/null || true
wait $SERVER 2>/dev/null || true
```

Expected: prints `OK`.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): tailwind + cosmic editorial design tokens"
```

---

## Task 3: shadcn/ui init + primitives

**Files:**
- Create: `web/src/lib/utils.ts`
- Create: `web/components.json`
- Create: `web/src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `popover.tsx`, `dialog.tsx`, `command.tsx`, `skeleton.tsx`

- [ ] **Step 1: Install shadcn deps**

```bash
cd web && npm install class-variance-authority clsx tailwind-merge lucide-react \
  @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-label @radix-ui/react-slot \
  cmdk tailwindcss-animate
npm install -D @types/node
```

- [ ] **Step 2: Enable `tailwindcss-animate` in the Tailwind config**

Modify `web/tailwind.config.ts` — add `require("tailwindcss-animate")` to the `plugins` array:

```ts
import type { Config } from "tailwindcss";

export default {
  // …everything from Task 2 unchanged, except:
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

- [ ] **Step 3: Create `web/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Create `web/components.json`** (shadcn config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": false,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 5: Create the 8 shadcn primitive components**

Create `web/src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-satellite disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-satellite text-bg hover:bg-satellite/90",
        ghost: "hover:bg-edge text-fg",
        outline: "border border-edge bg-transparent hover:bg-edge text-fg",
        destructive: "bg-danger text-bg hover:bg-danger/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
```

Create `web/src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-edge bg-bg-raised px-3 py-1 text-sm text-fg shadow-sm transition-colors placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-satellite disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
```

Create `web/src/components/ui/label.tsx`:

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("label-upper", className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
```

Create `web/src/components/ui/card.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("surface", className)} {...props} />
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";
```

Create `web/src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-edge", className)}
      {...props}
    />
  );
}
```

Create `web/src/components/ui/popover.tsx`:

```tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border border-edge bg-bg-raised p-4 text-fg shadow-md outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
```

Create `web/src/components/ui/dialog.tsx`:

```tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 surface p-6 shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-bg transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-satellite">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-serif italic text-lg", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
```

Create `web/src/components/ui/command.tsx`:

```tsx
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-bg-raised text-fg",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-edge px-3">
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-fg-muted"
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn("overflow-hidden p-1 text-fg", className)}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
      "data-[selected=true]:bg-edge data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;
```

- [ ] **Step 6: Verify the frontend still compiles**

```bash
just web-build
```

Expected: build completes with no TypeScript errors, writes `web/dist/`.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): shadcn/ui primitives"
```

---

## Task 4: Vitest + MSW test infrastructure

**Files:**
- Modify: `web/package.json` (add test scripts + deps)
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/test/msw/handlers.ts`
- Create: `web/src/test/msw/server.ts`

- [ ] **Step 1: Install test deps**

```bash
cd web && npm install -D vitest @vitest/ui jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  msw
```

- [ ] **Step 2: Add test scripts to `web/package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest",
"test:ui": "vitest --ui",
"lint": "eslint ."
```

- [ ] **Step 3: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 4: Create `web/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 5: Create `web/src/test/msw/handlers.ts`**

```ts
import { http, HttpResponse } from "msw";

// Default handlers — tests override per-test as needed via server.use(...)
export const handlers = [
  http.get("/api/catalog/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    if (!q) return HttpResponse.json([]);
    if (q.includes("iss")) {
      return HttpResponse.json([
        {
          display_name: "ISS (ZARYA)",
          match_type: "satellite",
          norad_ids: [25544],
          score: 100,
        },
      ]);
    }
    return HttpResponse.json([]);
  }),

  http.post("/api/passes", async () =>
    HttpResponse.json({
      query: "ISS",
      resolved_name: "ISS (ZARYA)",
      passes: [],
      tle_age_seconds: 0,
    }),
  ),
];
```

- [ ] **Step 6: Create `web/src/test/msw/server.ts`**

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 7: Write a smoke test**

Create `web/src/test/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("jsdom environment is alive", () => {
    expect(document).toBeDefined();
  });

  it("can fetch through msw", async () => {
    const r = await fetch("/api/catalog/search?q=iss");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body[0].norad_ids).toContain(25544);
  });
});
```

- [ ] **Step 8: Run tests**

```bash
just web-test
```

Expected: 2 tests pass.

- [ ] **Step 9: Commit**

```bash
git add web
git commit -m "test(web): vitest + MSW test harness"
```

---

## Task 5: API types + typed fetch client + TanStack Query

**Files:**
- Create: `web/src/types/api.ts`
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/query-client.ts`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Install TanStack Query**

```bash
cd web && npm install @tanstack/react-query @tanstack/react-query-devtools
```

- [ ] **Step 2: Create `web/src/types/api.ts`**

Mirrors `api/schemas/responses.py`.

```ts
// Mirror of api/schemas/responses.py. Keep in sync manually for now; a v2
// improvement is to generate these from the FastAPI OpenAPI schema.

export type VisibilityMode = "line-of-sight" | "naked-eye";

export interface PassEndpointResponse {
  time: string; // ISO-8601 UTC
  azimuth_deg: number;
  elevation_deg: number;
}

export interface PassResponse {
  kind: "single";
  id: string;
  norad_id: number;
  name: string;
  rise: PassEndpointResponse;
  peak: PassEndpointResponse;
  set: PassEndpointResponse;
  duration_s: number;
  max_magnitude: number | null;
  sunlit_fraction: number;
  tle_epoch: string;
}

export interface TrainPassResponse {
  kind: "train";
  id: string;
  name: string;
  member_norad_ids: number[];
  rise: PassEndpointResponse;
  peak: PassEndpointResponse;
  set: PassEndpointResponse;
  duration_s: number;
  max_magnitude: number | null;
  member_count: number;
}

export type PassItem = PassResponse | TrainPassResponse;

export interface TrackSampleResponse {
  time: string;
  lat: number;
  lng: number;
  alt_km: number;
  az: number;
  el: number;
  range_km: number;
  velocity_km_s: number;
  magnitude: number | null;
  sunlit: boolean;
  observer_dark: boolean;
}

export interface TLEFreshnessResponse {
  norad_id: number;
  name: string;
  tle_epoch: string;
  fetched_age_seconds: number;
}

export interface HorizonResponse {
  lat: number;
  lng: number;
  radius_km: number;
  samples_deg: number[]; // 360 values, index = azimuth deg
}

export interface CatalogHitResponse {
  display_name: string;
  match_type: "satellite" | "group";
  norad_ids: number[];
  score: number;
}

// Request bodies
export interface PassesRequest {
  lat: number;
  lng: number;
  elevation_m: number;
  query: string;
  from_utc: string;
  to_utc: string;
  mode: VisibilityMode;
  min_magnitude?: number | null;
  min_peak_elevation_deg?: number | null;
  apply_group_defaults?: boolean;
}

export interface SkyTrackRequest {
  lat: number;
  lng: number;
  elevation_m: number;
  query: string;
  from_utc: string;
  to_utc: string;
  dt_seconds: number;
}

export interface PassesResponseBody {
  query: string;
  resolved_name: string;
  passes: PassItem[];
  tle_age_seconds: number | null;
}

export interface SkyTrackResponseBody {
  resolved_name: string;
  samples: TrackSampleResponse[];
}
```

- [ ] **Step 3: Create `web/src/lib/api.ts`**

```ts
import type {
  CatalogHitResponse,
  HorizonResponse,
  PassesRequest,
  PassesResponseBody,
  SkyTrackRequest,
  SkyTrackResponseBody,
  TLEFreshnessResponse,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`${status}: ${detail}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // ignore — keep statusText
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  catalogSearch: (q: string, limit = 10) =>
    request<CatalogHitResponse[]>(
      `/catalog/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  passes: (body: PassesRequest) =>
    request<PassesResponseBody>("/passes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  skyTrack: (body: SkyTrackRequest) =>
    request<SkyTrackResponseBody>("/sky-track", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  horizon: (lat: number, lng: number, elevation_m = 0) =>
    request<HorizonResponse>(
      `/horizon?lat=${lat}&lng=${lng}&elevation_m=${elevation_m}`,
    ),

  tleFreshness: (query: string) =>
    request<TLEFreshnessResponse[]>(
      `/tle-freshness?query=${encodeURIComponent(query)}`,
    ),
};
```

- [ ] **Step 4: Create `web/src/lib/query-client.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Pass lookups are expensive (engine + DEM + skyfield), cache generously.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 5: Wire QueryClientProvider in `web/src/main.tsx`**

Overwrite `web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "@/App";
import { queryClient } from "@/lib/query-client";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Write a failing test for the api client**

Create `web/src/lib/api.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api, ApiError } from "@/lib/api";
import { server } from "@/test/msw/server";

describe("api client", () => {
  it("catalogSearch returns parsed hits", async () => {
    const hits = await api.catalogSearch("iss");
    expect(hits[0].display_name).toBe("ISS (ZARYA)");
  });

  it("throws ApiError with detail on 500", async () => {
    server.use(
      http.get("/api/catalog/search", () =>
        HttpResponse.json(
          { detail: "OpenTopography API key not set." },
          { status: 500 },
        ),
      ),
    );

    await expect(api.catalogSearch("iss")).rejects.toMatchObject({
      status: 500,
      detail: expect.stringContaining("API key"),
    });
    await expect(api.catalogSearch("iss")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
just web-test
```

Expected: 4 passed (2 smoke + 2 api).

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): API types + typed fetch client + TanStack Query"
```

---

## Task 6: Zustand stores (observer / satellite / time-range / selection)

**Files:**
- Create: `web/src/store/observer.ts`
- Create: `web/src/store/satellite.ts`
- Create: `web/src/store/time-range.ts`
- Create: `web/src/store/selection.ts`
- Tests: `web/src/store/observer.test.ts`, `web/src/store/time-range.test.ts`

- [ ] **Step 1: Install Zustand**

```bash
cd web && npm install zustand
```

- [ ] **Step 2: Create `web/src/store/observer.ts`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ObserverLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number;
}

interface ObserverState {
  current: { lat: number; lng: number; elevation_m: number; name: string };
  saved: ObserverLocation[];
  setCurrent: (loc: Partial<ObserverState["current"]>) => void;
  addSaved: (loc: Omit<ObserverLocation, "id">) => void;
  removeSaved: (id: string) => void;
  applySaved: (id: string) => void;
}

const DEFAULT_CURRENT = {
  lat: 40.7128,
  lng: -74.006,
  elevation_m: 10,
  name: "Brooklyn, NY",
};

export const useObserverStore = create<ObserverState>()(
  persist(
    (set, get) => ({
      current: DEFAULT_CURRENT,
      saved: [],
      setCurrent: (loc) =>
        set((s) => ({ current: { ...s.current, ...loc } })),
      addSaved: (loc) =>
        set((s) => ({
          saved: [
            ...s.saved,
            { ...loc, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),
      removeSaved: (id) =>
        set((s) => ({ saved: s.saved.filter((l) => l.id !== id) })),
      applySaved: (id) => {
        const target = get().saved.find((l) => l.id === id);
        if (target) {
          set({
            current: {
              lat: target.lat,
              lng: target.lng,
              elevation_m: target.elevation_m,
              name: target.name,
            },
          });
        }
      },
    }),
    { name: "satvis.observer" },
  ),
);
```

- [ ] **Step 3: Create `web/src/store/satellite.ts`**

```ts
import { create } from "zustand";

interface SatelliteState {
  query: string;
  resolvedName: string | null;
  setQuery: (q: string) => void;
  setResolved: (name: string | null) => void;
  clear: () => void;
}

export const useSatelliteStore = create<SatelliteState>((set) => ({
  query: "ISS",
  resolvedName: null,
  setQuery: (q) => set({ query: q, resolvedName: null }),
  setResolved: (name) => set({ resolvedName: name }),
  clear: () => set({ query: "", resolvedName: null }),
}));
```

- [ ] **Step 4: Create `web/src/store/time-range.ts`**

```ts
import { create } from "zustand";

interface TimeRangeState {
  fromUtc: string;
  toUtc: string;
  mode: "line-of-sight" | "naked-eye";
  setRange: (fromUtc: string, toUtc: string) => void;
  setMode: (m: TimeRangeState["mode"]) => void;
  applyPreset: (hours: number) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  fromUtc: nowIso(),
  toUtc: plusHoursIso(24),
  mode: "line-of-sight",
  setRange: (fromUtc, toUtc) => set({ fromUtc, toUtc }),
  setMode: (m) => set({ mode: m }),
  applyPreset: (hours) =>
    set({ fromUtc: nowIso(), toUtc: plusHoursIso(hours) }),
}));
```

- [ ] **Step 5: Create `web/src/store/selection.ts`**

```ts
import { create } from "zustand";

interface SelectionState {
  selectedPassId: string | null;
  select: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedPassId: null,
  select: (id) => set({ selectedPassId: id }),
}));
```

- [ ] **Step 6: Write tests for observer store**

Create `web/src/store/observer.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useObserverStore } from "@/store/observer";

describe("useObserverStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useObserverStore.setState({
      current: { lat: 0, lng: 0, elevation_m: 0, name: "test" },
      saved: [],
    });
  });

  it("setCurrent merges partial updates", () => {
    useObserverStore.getState().setCurrent({ lat: 40.7128 });
    expect(useObserverStore.getState().current.lat).toBe(40.7128);
    expect(useObserverStore.getState().current.name).toBe("test");
  });

  it("addSaved produces a unique id", () => {
    useObserverStore.getState().addSaved({
      name: "Backyard",
      lat: 40,
      lng: -74,
      elevation_m: 10,
    });
    expect(useObserverStore.getState().saved).toHaveLength(1);
    expect(useObserverStore.getState().saved[0].id).toBeTruthy();
  });

  it("applySaved copies a saved location into current", () => {
    useObserverStore.getState().addSaved({
      name: "Cabin",
      lat: 45.5,
      lng: -73.5,
      elevation_m: 500,
    });
    const id = useObserverStore.getState().saved[0].id;
    useObserverStore.getState().applySaved(id);
    expect(useObserverStore.getState().current.name).toBe("Cabin");
    expect(useObserverStore.getState().current.elevation_m).toBe(500);
  });

  it("removeSaved deletes by id", () => {
    useObserverStore.getState().addSaved({
      name: "X",
      lat: 0,
      lng: 0,
      elevation_m: 0,
    });
    const id = useObserverStore.getState().saved[0].id;
    useObserverStore.getState().removeSaved(id);
    expect(useObserverStore.getState().saved).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Write tests for time-range store**

Create `web/src/store/time-range.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { useTimeRangeStore } from "@/store/time-range";

describe("useTimeRangeStore", () => {
  it("applyPreset shifts to the given window in hours", () => {
    useTimeRangeStore.getState().applyPreset(168); // 7 days
    const s = useTimeRangeStore.getState();
    const span = new Date(s.toUtc).getTime() - new Date(s.fromUtc).getTime();
    // 168 h ± 1 second (for test execution time)
    expect(span).toBeGreaterThan(168 * 3600 * 1000 - 1000);
    expect(span).toBeLessThan(168 * 3600 * 1000 + 1000);
  });

  it("setMode updates mode", () => {
    useTimeRangeStore.getState().setMode("naked-eye");
    expect(useTimeRangeStore.getState().mode).toBe("naked-eye");
  });
});
```

- [ ] **Step 8: Run tests**

```bash
just web-test
```

Expected: all previous + 6 new = 10 passing.

- [ ] **Step 9: Commit**

```bash
git add web
git commit -m "feat(web): Zustand stores for observer, satellite, time-range, selection"
```

---

## Task 7: API query hooks

**Files:**
- Create: `web/src/hooks/use-catalog-search.ts`
- Create: `web/src/hooks/use-passes.ts`
- Create: `web/src/hooks/use-sky-track.ts`
- Create: `web/src/hooks/use-horizon.ts`
- Create: `web/src/hooks/use-tle-freshness.ts`
- Create: `web/src/hooks/use-geocode.ts`

- [ ] **Step 1: Create `web/src/hooks/use-catalog-search.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCatalogSearch(q: string) {
  return useQuery({
    queryKey: ["catalog-search", q],
    queryFn: () => api.catalogSearch(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Create `web/src/hooks/use-passes.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PassesRequest } from "@/types/api";

export function usePasses(req: PassesRequest | null) {
  return useQuery({
    queryKey: ["passes", req],
    queryFn: () => api.passes(req!),
    enabled: req !== null && req.query.length > 0,
  });
}
```

- [ ] **Step 3: Create `web/src/hooks/use-sky-track.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SkyTrackRequest } from "@/types/api";

export function useSkyTrack(req: SkyTrackRequest | null) {
  return useQuery({
    queryKey: ["sky-track", req],
    queryFn: () => api.skyTrack(req!),
    enabled: req !== null,
  });
}
```

- [ ] **Step 4: Create `web/src/hooks/use-horizon.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHorizon(lat: number, lng: number, elevation_m = 0) {
  return useQuery({
    queryKey: ["horizon", lat, lng, elevation_m],
    queryFn: () => api.horizon(lat, lng, elevation_m),
    // Horizon masks are per-location and don't change; cache forever.
    staleTime: Infinity,
  });
}
```

- [ ] **Step 5: Create `web/src/hooks/use-tle-freshness.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useTleFreshness(query: string) {
  return useQuery({
    queryKey: ["tle-freshness", query],
    queryFn: () => api.tleFreshness(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 6: Create `web/src/hooks/use-geocode.ts`**

OSM Nominatim — no API key required. Per ToS, send a user-agent; debounce at the call-site.

```ts
import { useQuery } from "@tanstack/react-query";

export interface GeocodeHit {
  display_name: string;
  lat: number;
  lng: number;
}

async function nominatim(q: string): Promise<GeocodeHit[]> {
  if (!q.trim()) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  const response = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const body = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return body.map((hit) => ({
    display_name: hit.display_name,
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
  }));
}

export function useGeocode(q: string) {
  return useQuery({
    queryKey: ["geocode", q],
    queryFn: () => nominatim(q),
    enabled: q.trim().length >= 3,
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): TanStack Query hooks for passes, sky-track, horizon, catalog, geocode"
```

---

## Task 8: App shell + header

**Files:**
- Create: `web/src/components/layout/app-shell.tsx`
- Create: `web/src/components/layout/header.tsx`
- Overwrite: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/components/layout/header.tsx`**

```tsx
import { useSatelliteStore } from "@/store/satellite";
import { useTleFreshness } from "@/hooks/use-tle-freshness";

export function Header() {
  const query = useSatelliteStore((s) => s.query);
  const { data } = useTleFreshness(query);
  const epochLine = data?.[0]
    ? `${data[0].name} · TLE ${formatAge(data[0].fetched_age_seconds)} old`
    : null;

  return (
    <header className="border-b border-edge bg-bg-raised">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="serif-accent text-xl">Orbit Observer</span>
          <span className="label-upper">Research-grade satellite tracker</span>
        </div>
        <div className="text-xs text-fg-muted">
          {epochLine ?? "Satellite: none selected"}
        </div>
      </div>
    </header>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
}
```

- [ ] **Step 2: Create `web/src/components/layout/app-shell.tsx`**

```tsx
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
```

- [ ] **Step 3: Overwrite `web/src/App.tsx`**

```tsx
import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <>
      <Header />
      <AppShell
        left={
          <Card>
            <CardHeader>
              <CardTitle>Observer</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Location, satellite, and time will live here.
            </CardContent>
          </Card>
        }
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Timeline + pass list.
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              The alt-az dome.
            </CardContent>
          </Card>
        }
      />
    </>
  );
}
```

- [ ] **Step 4: Verify it still builds**

```bash
just web-build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): app shell layout + header"
```

---

## Task 9: Address search (Nominatim)

**Files:**
- Create: `web/src/components/observer/address-search.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from "react";
import { useGeocode } from "@/hooks/use-geocode";
import { useObserverStore } from "@/store/observer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Tiny debounce helper (not worth a library).
function useDebouncedEffect(fn: () => void, delay: number, deps: unknown[]) {
  useEffect(() => {
    const h = setTimeout(fn, delay);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function AddressSearch() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const setCurrent = useObserverStore((s) => s.setCurrent);
  const { data, isFetching } = useGeocode(debounced);

  // Debounce typing.
  useDebouncedEffect(() => setDebounced(input), 350, [input]);

  return (
    <div className="space-y-2">
      <Label htmlFor="address">Address</Label>
      <Input
        id="address"
        placeholder="Brooklyn, NY"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {input && data && data.length > 0 && (
        <ul className="surface divide-y divide-edge max-h-56 overflow-y-auto">
          {data.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-edge"
                onClick={() => {
                  setCurrent({
                    lat: hit.lat,
                    lng: hit.lng,
                    name: hit.display_name.split(",").slice(0, 2).join(",").trim(),
                  });
                  setInput(hit.display_name);
                }}
              >
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isFetching && <p className="text-xs text-fg-muted">Searching…</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web
git commit -m "feat(web): address search via Nominatim"
```

---

## Task 10: Leaflet map picker

**Files:**
- Create: `web/src/components/observer/map-picker.tsx`
- Modify: `web/src/index.css` (Leaflet base CSS)

- [ ] **Step 1: Install Leaflet**

```bash
cd web && npm install leaflet && npm install -D @types/leaflet
```

- [ ] **Step 2: Append Leaflet CSS import to `web/src/index.css`**

Add at the very top, above the `@tailwind` lines:

```css
@import "leaflet/dist/leaflet.css";
```

- [ ] **Step 3: Implement `web/src/components/observer/map-picker.tsx`**

```tsx
import { useEffect, useRef } from "react";
import L from "leaflet";
import { useObserverStore } from "@/store/observer";

// Default Leaflet marker icons don't bundle through Vite — use CDN URLs.
const MARKER_ICON = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function MapPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const current = useObserverStore((s) => s.current);
  const setCurrent = useObserverStore((s) => s.setCurrent);

  // Mount once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [current.lat, current.lng],
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark tile layer keeps the Cosmic Editorial vibe.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    const marker = L.marker([current.lat, current.lng], {
      draggable: true,
      icon: MARKER_ICON,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setCurrent({ lat: e.latlng.lat, lng: e.latlng.lng, name: "Map pick" });
    });

    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      setCurrent({ lat: ll.lat, lng: ll.lng, name: "Map pick" });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + view when the store changes externally (saved loc, geocode).
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const ll = L.latLng(current.lat, current.lng);
    marker.setLatLng(ll);
    map.setView(ll, map.getZoom(), { animate: true });
  }, [current.lat, current.lng]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full rounded-card overflow-hidden border border-edge"
      role="region"
      aria-label="Map picker"
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): Leaflet map picker with dark tiles"
```

---

## Task 11: Saved locations + observer panel

**Files:**
- Create: `web/src/components/observer/saved-locations.tsx`
- Create: `web/src/components/observer/observer-panel.tsx`
- Modify: `web/src/App.tsx` (swap placeholder)

- [ ] **Step 1: Implement `web/src/components/observer/saved-locations.tsx`**

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useObserverStore } from "@/store/observer";

export function SavedLocations() {
  const { current, saved, addSaved, removeSaved, applySaved } = useObserverStore();
  const [name, setName] = useState("");

  return (
    <div className="space-y-3">
      <Label>Saved locations</Label>
      {saved.length === 0 && (
        <p className="text-xs text-fg-muted">
          Save the current location below to quickly return to it later.
        </p>
      )}
      <ul className="space-y-1">
        {saved.map((loc) => (
          <li key={loc.id} className="flex items-center justify-between gap-2">
            <button
              onClick={() => applySaved(loc.id)}
              className="flex-1 text-left text-sm px-2 py-1 rounded hover:bg-edge"
              title={`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}
            >
              {loc.name}
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`remove ${loc.name}`}
              onClick={() => removeSaved(loc.id)}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          placeholder="Save current as…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={!name.trim()}
          onClick={() => {
            addSaved({
              name: name.trim(),
              lat: current.lat,
              lng: current.lng,
              elevation_m: current.elevation_m,
            });
            setName("");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `web/src/components/observer/observer-panel.tsx`**

```tsx
import { AddressSearch } from "@/components/observer/address-search";
import { MapPicker } from "@/components/observer/map-picker";
import { SavedLocations } from "@/components/observer/saved-locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useObserverStore } from "@/store/observer";

export function ObserverPanel() {
  const current = useObserverStore((s) => s.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observer</CardTitle>
        <p className="text-xs text-fg-muted">
          {current.name} · {current.lat.toFixed(4)}°, {current.lng.toFixed(4)}°
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddressSearch />
        <MapPicker />
        <SavedLocations />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Wire into `web/src/App.tsx`**

Replace the `left` prop in App with `<ObserverPanel />`:

```tsx
import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <>
      <Header />
      <AppShell
        left={<ObserverPanel />}
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Coming in the next task.
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">Coming later.</CardContent>
          </Card>
        }
      />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): observer panel — address + map + saved locations"
```

---

## Task 12: Satellite search (Command menu)

**Files:**
- Create: `web/src/components/satellite/satellite-search.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSatelliteStore } from "@/store/satellite";
import { useCatalogSearch } from "@/hooks/use-catalog-search";

export function SatelliteSearch() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const query = useSatelliteStore((s) => s.query);
  const setQuery = useSatelliteStore((s) => s.setQuery);
  const { data: hits, isFetching } = useCatalogSearch(input);

  return (
    <div className="space-y-2">
      <Label>Satellite</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {query || "Pick a satellite or group"}
            <span className="opacity-50">▾</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="ISS, starlink, 25544…"
              value={input}
              onValueChange={setInput}
            />
            <CommandList>
              {!isFetching && (!hits || hits.length === 0) && (
                <CommandEmpty>No matches.</CommandEmpty>
              )}
              {hits && hits.length > 0 && (
                <CommandGroup>
                  {hits.map((hit) => (
                    <CommandItem
                      key={`${hit.match_type}-${hit.display_name}`}
                      value={hit.display_name}
                      onSelect={() => {
                        setQuery(hit.display_name);
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1">{hit.display_name}</span>
                      <span className="text-xs text-fg-muted">
                        {hit.match_type}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web
git commit -m "feat(web): satellite fuzzy search via Command menu"
```

---

## Task 13: Time range picker + inputs bar

**Files:**
- Create: `web/src/components/time/time-range-picker.tsx`
- Create: `web/src/components/layout/inputs-bar.tsx`
- Modify: `web/src/App.tsx` (wire into left panel)
- Modify: `web/src/components/observer/observer-panel.tsx` (drop inputs into observer panel instead — final layout TBD below)

- [ ] **Step 1: Implement `web/src/components/time/time-range-picker.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTimeRangeStore } from "@/store/time-range";

function toLocalInput(iso: string): string {
  // HTML datetime-local expects YYYY-MM-DDTHH:mm in local tz.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function TimeRangePicker() {
  const { fromUtc, toUtc, mode, setRange, setMode, applyPreset } =
    useTimeRangeStore();

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="from-utc">From (local)</Label>
        <Input
          id="from-utc"
          type="datetime-local"
          value={toLocalInput(fromUtc)}
          onChange={(e) => setRange(fromLocalInput(e.target.value), toUtc)}
        />
      </div>
      <div>
        <Label htmlFor="to-utc">To (local)</Label>
        <Input
          id="to-utc"
          type="datetime-local"
          value={toLocalInput(toUtc)}
          onChange={(e) => setRange(fromUtc, fromLocalInput(e.target.value))}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => applyPreset(24)}>
          Next 24 h
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset(72)}>
          Next 3 d
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset(168)}>
          Next 7 d
        </Button>
      </div>

      <div>
        <Label>Mode</Label>
        <div className="flex gap-2">
          <Button
            variant={mode === "line-of-sight" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("line-of-sight")}
          >
            Line-of-sight
          </Button>
          <Button
            variant={mode === "naked-eye" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("naked-eye")}
          >
            Naked-eye
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `web/src/components/layout/inputs-bar.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SatelliteSearch } from "@/components/satellite/satellite-search";
import { TimeRangePicker } from "@/components/time/time-range-picker";

export function InputsBar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Query</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SatelliteSearch />
        <TimeRangePicker />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Update `web/src/App.tsx`**

```tsx
import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { InputsBar } from "@/components/layout/inputs-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <>
      <Header />
      <AppShell
        left={
          <>
            <ObserverPanel />
            <InputsBar />
          </>
        }
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Coming in the next task.
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">Coming later.</CardContent>
          </Card>
        }
      />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): time-range + mode picker, inputs bar"
```

---

## Task 14: Pass list + card

**Files:**
- Create: `web/src/components/passes/pass-card.tsx`
- Create: `web/src/components/passes/pass-list.tsx`
- Create: `web/src/hooks/use-current-passes.ts` (composes stores → PassesRequest)

- [ ] **Step 1: Implement `web/src/hooks/use-current-passes.ts`**

```ts
import { useMemo } from "react";
import { usePasses } from "@/hooks/use-passes";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";
import type { PassesRequest } from "@/types/api";

export function useCurrentPasses() {
  const current = useObserverStore((s) => s.current);
  const query = useSatelliteStore((s) => s.query);
  const { fromUtc, toUtc, mode } = useTimeRangeStore();

  const req = useMemo<PassesRequest | null>(() => {
    if (!query.trim()) return null;
    return {
      lat: current.lat,
      lng: current.lng,
      elevation_m: current.elevation_m,
      query,
      from_utc: fromUtc,
      to_utc: toUtc,
      mode,
    };
  }, [current, query, fromUtc, toUtc, mode]);

  return usePasses(req);
}
```

- [ ] **Step 2: Implement `web/src/components/passes/pass-card.tsx`**

```tsx
import { useSelectionStore } from "@/store/selection";
import type { PassItem } from "@/types/api";
import { cn } from "@/lib/utils";

interface Props {
  pass: PassItem;
}

export function PassCard({ pass }: Props) {
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selectedId === pass.id;

  const riseLocal = new Date(pass.rise.time).toLocaleString();
  const mag =
    pass.max_magnitude != null ? `mag ${pass.max_magnitude.toFixed(1)}` : null;

  return (
    <button
      onClick={() => select(pass.id)}
      className={cn(
        "w-full text-left p-3 rounded-card border transition-colors",
        isSelected
          ? "border-satellite bg-satellite/5"
          : "border-edge hover:bg-edge",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium truncate">
          {pass.kind === "train" ? pass.name : pass.name}
        </div>
        <div className="text-xs text-fg-muted tabular-nums">
          {formatDuration(pass.duration_s)}
        </div>
      </div>
      <div className="text-xs text-fg-muted mt-1">{riseLocal}</div>
      <div className="text-xs text-fg-muted mt-0.5 tabular-nums">
        peak {pass.peak.elevation_deg.toFixed(0)}° ·{" "}
        {pass.peak.azimuth_deg.toFixed(0)}°
        {mag && ` · ${mag}`}
      </div>
      {pass.kind === "train" && (
        <div className="text-xs text-satellite mt-1">
          {pass.member_count} objects
        </div>
      )}
    </button>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
```

- [ ] **Step 3: Implement `web/src/components/passes/pass-list.tsx`**

```tsx
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { PassCard } from "@/components/passes/pass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";

export function PassList() {
  const { data, isFetching, error } = useCurrentPasses();

  if (isFetching && !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    const detail = error instanceof ApiError ? error.detail : String(error);
    return (
      <div className="p-4 rounded-card border border-danger/50 bg-danger/5 text-danger text-sm">
        {detail}
      </div>
    );
  }

  if (!data || data.passes.length === 0) {
    return (
      <div className="p-6 text-sm text-fg-muted">
        No visible passes in the selected window.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="label-upper">
        {data.passes.length} pass{data.passes.length === 1 ? "" : "es"} ·{" "}
        {data.resolved_name}
      </div>
      {data.passes.map((p) => (
        <PassCard key={p.id} pass={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `web/src/App.tsx`**

Replace the `main` slot:

```tsx
import { PassList } from "@/components/passes/pass-list";
// …

        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent>
              <PassList />
            </CardContent>
          </Card>
        }
```

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): pass list with selection and state-driven request"
```

---

## Task 15: Timeline strip (SVG)

**Files:**
- Create: `web/src/components/passes/timeline-strip.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useMemo } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import { useTimeRangeStore } from "@/store/time-range";

const STRIP_HEIGHT = 48;

export function TimelineStrip() {
  const { data } = useCurrentPasses();
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const { fromUtc, toUtc } = useTimeRangeStore();

  const { bars, dayTicks } = useMemo(() => {
    if (!data || data.passes.length === 0) return { bars: [], dayTicks: [] };
    const start = new Date(fromUtc).getTime();
    const end = new Date(toUtc).getTime();
    const span = Math.max(end - start, 1);

    const bars = data.passes.map((p) => {
      const t0 = new Date(p.rise.time).getTime();
      const t1 = new Date(p.set.time).getTime();
      return {
        id: p.id,
        leftPct: ((t0 - start) / span) * 100,
        widthPct: Math.max(((t1 - t0) / span) * 100, 0.4),
      };
    });

    const dayTicks: number[] = [];
    const firstDayBoundary = new Date(start);
    firstDayBoundary.setUTCHours(0, 0, 0, 0);
    firstDayBoundary.setUTCDate(firstDayBoundary.getUTCDate() + 1);
    for (let t = firstDayBoundary.getTime(); t < end; t += 86400 * 1000) {
      dayTicks.push(((t - start) / span) * 100);
    }

    return { bars, dayTicks };
  }, [data, fromUtc, toUtc]);

  if (!data || data.passes.length === 0) return null;

  return (
    <div className="relative w-full" style={{ height: STRIP_HEIGHT }}>
      {/* axis line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-edge" />
      {/* day ticks */}
      {dayTicks.map((pct, i) => (
        <div
          key={i}
          className="absolute top-[40%] w-px h-[20%] bg-fg-subtle"
          style={{ left: `${pct}%` }}
        />
      ))}
      {/* pass bars */}
      {bars.map((bar) => {
        const isSelected = bar.id === selectedId;
        return (
          <button
            key={bar.id}
            onClick={() => select(bar.id)}
            className={`absolute top-[32%] h-[36%] rounded-sm transition-colors ${
              isSelected
                ? "bg-satellite shadow-glow"
                : "bg-satellite/30 hover:bg-satellite/60"
            }`}
            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
            aria-label={`Pass at ${bar.leftPct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire above the pass list in `web/src/App.tsx`**

```tsx
import { TimelineStrip } from "@/components/passes/timeline-strip";
// …
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TimelineStrip />
              <PassList />
            </CardContent>
          </Card>
        }
```

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "feat(web): SVG timeline strip with selectable bars"
```

---

## Task 16: Sky view — dome + compass + elevation rings

**Files:**
- Create: `web/src/components/sky-view/dome.tsx`
- Create: `web/src/components/sky-view/compass.tsx`
- Create: `web/src/components/sky-view/sky-view.tsx`

- [ ] **Step 1: Implement `web/src/components/sky-view/dome.tsx`**

```tsx
export const DOME_SIZE = 320;
export const DOME_RADIUS = 140;
export const DOME_CENTER = DOME_SIZE / 2;

// Convert (azimuth, elevation) to SVG (x, y). Azimuth 0° = north = up in the
// SVG (y negative). Elevation 90° = zenith = center.
export function altAzToXy(az_deg: number, el_deg: number) {
  const r = ((90 - el_deg) / 90) * DOME_RADIUS;
  const az_rad = (az_deg * Math.PI) / 180;
  const x = DOME_CENTER + r * Math.sin(az_rad);
  const y = DOME_CENTER - r * Math.cos(az_rad);
  return { x, y };
}

export function Dome() {
  return (
    <>
      {/* outer horizon ring */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={DOME_RADIUS}
        className="fill-bg-raised stroke-edge"
      />
      {/* elevation rings at 30° and 60° */}
      {[30, 60].map((el) => (
        <circle
          key={el}
          cx={DOME_CENTER}
          cy={DOME_CENTER}
          r={((90 - el) / 90) * DOME_RADIUS}
          className="fill-none stroke-edge"
          strokeDasharray="2 3"
        />
      ))}
      {/* zenith dot */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={1.5}
        className="fill-fg-muted"
      />
    </>
  );
}
```

- [ ] **Step 2: Implement `web/src/components/sky-view/compass.tsx`**

```tsx
import { DOME_CENTER, DOME_RADIUS, altAzToXy } from "./dome";

const DIRS = [
  { label: "N", az: 0 },
  { label: "E", az: 90 },
  { label: "S", az: 180 },
  { label: "W", az: 270 },
];

export function Compass() {
  return (
    <>
      {DIRS.map((d) => {
        const p = altAzToXy(d.az, -6);
        return (
          <text
            key={d.label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-fg-muted text-[10px]"
          >
            {d.label}
          </text>
        );
      })}
      {/* cardinal tick marks at the horizon */}
      {DIRS.map((d) => {
        const outer = altAzToXy(d.az, 0);
        const inner = altAzToXy(d.az, 3);
        return (
          <line
            key={`tick-${d.label}`}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className="stroke-edge-strong"
            strokeWidth={1}
          />
        );
      })}
      {/* invisible radius guard */}
      <circle
        cx={DOME_CENTER}
        cy={DOME_CENTER}
        r={DOME_RADIUS + 8}
        fill="none"
      />
    </>
  );
}
```

- [ ] **Step 3: Implement `web/src/components/sky-view/sky-view.tsx`**

```tsx
import { Dome, DOME_SIZE } from "./dome";
import { Compass } from "./compass";

export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <Compass />
    </svg>
  );
}
```

- [ ] **Step 4: Wire into `web/src/App.tsx`**

Replace the `side` slot:

```tsx
import { SkyView } from "@/components/sky-view/sky-view";
// …
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent>
              <SkyView />
            </CardContent>
          </Card>
        }
```

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): SVG sky dome with compass and elevation rings"
```

---

## Task 17: Sky view — horizon silhouette

**Files:**
- Create: `web/src/components/sky-view/horizon-silhouette.tsx`
- Modify: `web/src/components/sky-view/sky-view.tsx`

- [ ] **Step 1: Implement `web/src/components/sky-view/horizon-silhouette.tsx`**

```tsx
import { useHorizon } from "@/hooks/use-horizon";
import { useObserverStore } from "@/store/observer";
import { DOME_CENTER, altAzToXy } from "./dome";

export function HorizonSilhouette() {
  const current = useObserverStore((s) => s.current);
  const { data, isFetching, error } = useHorizon(
    current.lat,
    current.lng,
    current.elevation_m,
  );

  if (isFetching && !data) {
    return (
      <text
        x={DOME_CENTER}
        y={DOME_CENTER}
        textAnchor="middle"
        className="fill-fg-subtle text-[10px]"
      >
        Loading horizon…
      </text>
    );
  }

  if (error || !data) return null;

  // Build a closed path that traces the terrain silhouette above the horizon
  // line. For each azimuth az ∈ [0..359], compute the terrain elevation
  // angle, then draw to the corresponding (x, y). Close the path back along
  // the horizon (elevation = 0).
  const points: string[] = [];
  for (let az = 0; az < 360; az += 1) {
    const el = Math.max(data.samples_deg[az], 0);
    const p = altAzToXy(az, el);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  // Close the polygon back along el=0 to fill the silhouette below.
  for (let az = 359; az >= 0; az -= 1) {
    const p = altAzToXy(az, 0);
    points.push(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }

  return (
    <polygon
      points={points.join(" ")}
      className="fill-observer/10 stroke-observer/40"
      strokeWidth={0.75}
      strokeLinejoin="round"
    />
  );
}
```

- [ ] **Step 2: Update `web/src/components/sky-view/sky-view.tsx`**

```tsx
import { Dome, DOME_SIZE } from "./dome";
import { Compass } from "./compass";
import { HorizonSilhouette } from "./horizon-silhouette";

export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <HorizonSilhouette />
      <Compass />
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "feat(web): terrain horizon silhouette on sky view"
```

---

## Task 18: Sky view — satellite arc for selected pass

**Files:**
- Create: `web/src/components/sky-view/satellite-arc.tsx`
- Modify: `web/src/components/sky-view/sky-view.tsx`
- Create: `web/src/hooks/use-current-sky-track.ts`

- [ ] **Step 1: Implement `web/src/hooks/use-current-sky-track.ts`**

```ts
import { useMemo } from "react";
import { useSkyTrack } from "@/hooks/use-sky-track";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import type { SkyTrackRequest } from "@/types/api";

export function useCurrentSkyTrack() {
  const current = useObserverStore((s) => s.current);
  const query = useSatelliteStore((s) => s.query);
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const { data: passes } = useCurrentPasses();

  const req = useMemo<SkyTrackRequest | null>(() => {
    if (!passes || !selectedId) return null;
    const pass = passes.passes.find((p) => p.id === selectedId);
    if (!pass) return null;
    return {
      lat: current.lat,
      lng: current.lng,
      elevation_m: current.elevation_m,
      query,
      from_utc: pass.rise.time,
      to_utc: pass.set.time,
      dt_seconds: 2,
    };
  }, [current, query, selectedId, passes]);

  return useSkyTrack(req);
}
```

- [ ] **Step 2: Implement `web/src/components/sky-view/satellite-arc.tsx`**

```tsx
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { altAzToXy } from "./dome";

export function SatelliteArc() {
  const { data } = useCurrentSkyTrack();
  if (!data || data.samples.length === 0) return null;

  // Drop samples below the horizon — they only pollute the path.
  const visible = data.samples.filter((s) => s.el >= 0);
  if (visible.length < 2) return null;

  const d = visible
    .map((s, i) => {
      const p = altAzToXy(s.az, s.el);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  // Peak: sample with max elevation.
  const peak = visible.reduce((best, s) => (s.el > best.el ? s : best), visible[0]);
  const peakP = altAzToXy(peak.az, peak.el);

  return (
    <>
      <path
        d={d}
        className="fill-none stroke-satellite"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={peakP.x}
        cy={peakP.y}
        r={3}
        className="fill-satellite"
      />
    </>
  );
}
```

- [ ] **Step 3: Update `web/src/components/sky-view/sky-view.tsx`**

```tsx
import { Dome, DOME_SIZE } from "./dome";
import { Compass } from "./compass";
import { HorizonSilhouette } from "./horizon-silhouette";
import { SatelliteArc } from "./satellite-arc";

export function SkyView() {
  return (
    <svg
      viewBox={`0 0 ${DOME_SIZE} ${DOME_SIZE}`}
      className="w-full max-w-[320px] mx-auto"
      role="img"
      aria-label="Sky view — looking up from the observer"
    >
      <Dome />
      <HorizonSilhouette />
      <SatelliteArc />
      <Compass />
    </svg>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): satellite arc on sky view for selected pass"
```

---

## Task 19: README + Justfile updates

**Files:**
- Modify: `README.md`
- Modify: `Justfile` (coverage recipe includes api + catalog)

- [ ] **Step 1: Append frontend section to README.md**

After the "Run the local API" section, insert:

```markdown
## Run the frontend

In one shell, start the API:

```bash
just serve
```

In another shell, start the Vite dev server:

```bash
just web-install   # first time only
just web
```

Open `http://127.0.0.1:5173/`.

The frontend proxies `/api/*` to the local API at `127.0.0.1:8765`, so CORS
is a non-issue in dev. Observer location and saved spots persist via
`localStorage`. Satellite search uses `GET /catalog/search`; passes come
from `POST /passes`; the sky view mounts `GET /horizon` + `POST /sky-track`
on pass selection.

### Production build

```bash
just web-build
```

Writes `web/dist/`. Serve it however you like (M5+ may bundle this behind
the FastAPI app or via a small static server).

### Frontend tests

```bash
just web-test        # one-shot
just web-test-watch  # watch mode
just web-lint
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: frontend run instructions in README"
```

---

## Task 20: Final gates — lint + tests + tag

- [ ] **Step 1: Python test suite**

```bash
just test
```

Expected: all Python tests pass (new catalog endpoint tests included).

- [ ] **Step 2: Python lint**

```bash
just lint
```

Expected: clean.

- [ ] **Step 3: Frontend tests**

```bash
just web-test
```

Expected: all vitest suites pass.

- [ ] **Step 4: Frontend lint**

```bash
just web-lint
```

Expected: clean (or fix whatever is reported; no rule disables).

- [ ] **Step 5: Frontend type-check via build**

```bash
just web-build
```

Expected: no TypeScript errors, `web/dist/` created.

- [ ] **Step 6: Commit any cleanup**

```bash
git add -A
git commit -m "chore: M3 lint and test cleanup" || echo "nothing to commit"
```

- [ ] **Step 7: Tag the milestone**

```bash
git tag -a m3-frontend -m "M3: minimal frontend"
git tag -l
```

Expected: `m3-frontend` appears alongside `m1-engine` and `m2-terrain-api`.

---

## M3 Completion Criteria

- [ ] `GET /catalog/search` lives in `api/routes/catalog.py`, registered and tested
- [ ] `just web` starts a Vite dev server on port 5173
- [ ] Tailwind + shadcn primitives render in the Cosmic Editorial palette
- [ ] Observer panel: address search, Leaflet map picker, saved locations (persisted)
- [ ] Satellite search: Command-menu typeahead against `/catalog/search`
- [ ] Time range: datetime-local inputs + preset buttons + line-of-sight/naked-eye toggle
- [ ] Pass list renders from `POST /passes` with selection state
- [ ] Timeline strip shows all passes; clicking selects
- [ ] Sky view SVG: dome + compass + elevation rings + terrain silhouette + satellite arc for selected pass
- [ ] `localStorage` persists observer saved spots across reloads
- [ ] `just test` + `just web-test` + `just lint` + `just web-lint` + `just web-build` all clean
- [ ] `m3-frontend` git tag created
