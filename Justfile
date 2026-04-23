set shell := ["bash", "-c"]

# list recipes
default:
    @just --list

# Run the entire test suite.
test:
    source .venv/bin/activate && pytest

# Run a single test file or expression, verbose.
# Examples:
#   just test-one tests/unit/test_horizon.py
#   just test-one "tests/unit/test_tle_fetcher.py::test_rate_limiter_enforces_minimum_spacing"
test-one TARGET:
    source .venv/bin/activate && pytest {{TARGET}} -v

# Run the unit tests only (fast; skips golden/integration).
test-unit:
    source .venv/bin/activate && pytest tests/unit -v

# Run the golden + integration tests.
test-golden:
    source .venv/bin/activate && pytest tests/golden tests/integration -v

# Run the full suite with coverage reporting (core + api).
cov:
    source .venv/bin/activate && pytest --cov=core --cov=api --cov-report=term-missing

# Run ruff lint across source and tests.
lint:
    source .venv/bin/activate && ruff check core api tests scripts

# Run ruff with --fix to auto-fix what it can.
lint-fix:
    source .venv/bin/activate && ruff check --fix core api tests scripts

# Run the M1 demo CLI (ISS over NYC by default).
demo *ARGS:
    source .venv/bin/activate && python scripts/demo.py {{ARGS}}

# Run the accuracy verification helper (prints engine passes + Heavens-Above URL).
verify *ARGS:
    source .venv/bin/activate && python scripts/verify_accuracy.py {{ARGS}}

# Start the local API on http://127.0.0.1:8765 (SATVIS_HOST / SATVIS_PORT override).
serve:
    ./scripts/serve.sh

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

# Frontend coverage report (v8 over all src files).
web-cov:
    cd web && npx vitest run --coverage

# Frontend ESLint.
web-lint:
    cd web && npm run lint
