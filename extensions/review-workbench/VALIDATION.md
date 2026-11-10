# Review candidate validation — 2026-11-10

Base: `rectangle-selection` commit `d24307915ca894b66b690bb6fccff03c72a5570f`.
Scope: optional companion extension, English demo, setup guide, workspace/lockfile.
Core package source, exports, version, dependency declarations and MCP source are unchanged.

## Completed checks

- Frozen-lockfile workspace installation succeeded in a separate clone.
- Core package build succeeded; **300/300** existing core tests passed.
- **15/15** extension tests passed (scope/origin, safe text rendering, cache
  preservation, delete/cancel, applied state, host callbacks, editable vs preview drafts).
- Extension TypeScript check, ESM/declaration build and Vite demo build succeeded.
  The companion ESM build retains its `use client` directive.
- Playwright/Chrome with 1440×1000 and 390×844 viewports: English owner controls,
  native comment popup, mode/submit shortcuts, draft protection, Applied checkmark,
  delete confirmation with Cancel focus, injected HTTP 503 and successful retry,
  deleted note absent after reload, Tiptap edit/save/reload, Drawesome stroke/save/
  static image reload, and no horizontal page overflow. The status notice was
  moved inside the open list after a screenshot exposed an overlap with shortcuts.
- A separate real local Agentation HTTP server on port 4760 received the exact
  test note and page. It used in-memory storage (SQLite bindings were unavailable
  after the install's `--ignore-scripts`). The user's live server was not used.
- Impeccable's mechanical detector returned `[]`; rendered desktop/narrow list and
  drawing-editor captures were inspected. This is not an accessibility certification.
- Added source was checked for private portfolio text/paths, credential-like
  patterns and generated output. Only generic sample text is distributed.

## Environment caveats / warnings

This host used Node **26.4.0**. The initial unmodified core test run failed because
Node's experimental global web storage shadowed jsdom's storage. Re-running with
`NODE_OPTIONS=--no-experimental-webstorage` passed all 300 tests. The extension's
15 tests were also run with that setting. It is a per-command test environment
setting, not an OS/configuration change.

The Vite demo build reports large chunks and ignored `use client` directives
(normal client-only demo bundling), plus an out-of-root demo-dist notice. The
separate reusable extension build includes `use client`; Next.js integration was
not executed. The demo is not optimized as a production marketing page.

## Existing dependency alerts — NOT resolved

`pnpm audit --prod --json` on both this candidate and the original checkout
reported the **same** counts: 1 critical, 9 high, 10 moderate, 2 low. The reported
paths belong to the existing `package/example` documentation site (Next.js and
its dependencies) and existing `mcp` dependencies, not this extension's runtime
dependency graph. They were not upgraded as part of this bounded feature port.
Matching counts are not a finding-specific exploitability assessment or waiver.

Examples of reported advisories:

- Next.js: https://github.com/advisories/GHSA-2464-fhr4-w9xw
- MCP SDK: https://github.com/advisories/GHSA-46jr-4wx8-v453
- Zod: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

Do not deploy the documentation website/MCP service to the internet on the basis
of these checks. Independently review and remediate affected dependencies before
a production release. There is no npm publish, version bump, default-branch merge
or hosted deployment in this task.

## Explicitly not checked / not included

- Independent Maker-Checker review (this side conversation cannot launch agents).
- A separate coding agent reading the test through its MCP client; only the exact
  browser → isolated real HTTP server handoff was checked. Complete the guide's
  end-to-end agent check in each recipient's setup.
- Physical phones, Safari/Firefox, screen readers, React 19 or Next.js consumers.
- Production authentication, authorization, file-writing APIs, migrations, rich
  text feature parity with the private portfolio editor, or mobile text-to-ink anchoring.
- Hash-route storage and multiple toolbars in the same document.

Owner actions are opt-in integration callbacks. The concrete demo adapters save
only in browser storage. Each recipient must connect their own authorized content
model and persistence; no private portfolio routes, content or stored comments
are included. Preserve all upstream and dependency license notices.
