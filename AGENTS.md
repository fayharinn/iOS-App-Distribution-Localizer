# Repository Guidelines

## Project Structure & Module Organization
- `src/` app code: `components/` (UI + shadcn pieces), `services/` (AI translation + App Store Connect), `utils/` (parsers/helpers), `hooks/`, `assets/`, entries `App.jsx`/`main.jsx`.
- `public/` static files; `dist/` build output; `worker/` + `wrangler*.jsonc` for the Cloudflare proxy; `vite.config.js` holds the local dev proxy.
- Co-locate feature helpers with their UI; keep modules small and single-purpose.

## Build, Test, and Development Commands
- Install deps once: `npm install`.
- Develop with hot reload + proxy: `npm run dev` (Vite at http://localhost:5173).
- Production build: `npm run build` → outputs to `dist/`.
- Preview a build locally: `npm run preview`.
- Lint JS/JSX: `npm run lint`; use `npm run lint -- --fix` for autofixes.
- Deploy to GitHub Pages: `npm run deploy` (builds, publishes `dist/`).

## Coding Style & Naming Conventions
- React 19 + ES modules; functional components and hooks preferred.
- Names: PascalCase components (`UploadPanel.jsx`), camelCase utilities/hooks (`xcstringsParser.js`, `useMobile.js`), kebab-case assets.
- Tailwind + shadcn/ui; order utility classes logically (layout → spacing → color → state).
- 2-space indent, single quotes in JS/JSX; avoid unused exports. `eslint.config.js` (core + React Hooks) is the source of truth.
- Keep side effects in hooks/services; aim for presentational UI components.

## Testing Guidelines
- No baked-in harness; when adding tests, prefer Vitest + Testing Library, collocated `*.test.js` or `__tests__/`.
- Manually verify: `.xcstrings` upload/parse, translation queue, protected words, App Store Connect auth, export/download paths.
- Cover concurrency controls, API error messaging, and protected-word handling for new code.

## Commit & Pull Request Guidelines
- Commit subjects: short, imperative (e.g., `Add proxy error handling`, `Tighten translation table filters`); use bodies for rationale.
- PRs: summary, linked issue, screenshots for UI, env/migration notes, and local checks (`npm run lint`, tests if present).
- Call out known gaps or follow-ups in the description.

## Security & Configuration Tips
- Never commit secrets or App Store Connect `.p8` keys; keep them in `.env.local`/`.env.production` (`VITE_*` vars).
- When proxy URLs change, update both `VITE_ASC_PROXY_URL` and `wrangler.proxy.jsonc`; keep `worker/` config in sync.
- Credentials are session-only; reviewers may need to re-enter keys to reproduce.
