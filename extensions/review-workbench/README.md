# Review Workbench — optional fork extension

Experimental companion for the `yhmxiii/agentation` fork. It leaves the original
package API, license, dependencies and selection behavior unchanged. All new UI
labels are English. This is source distribution, **not an npm release or a hosted service**.

## Included

- Compact Comments list with Pending / Acknowledged / checkmarked Applied states.
- Delete → confirmation (Cancel focused first), loading/error/retry, and local
  cache cleanup so a deleted item is not resurrected on reload.
- Manual Mark applied and polling for status changes made by your coding agent.
- `⌘⇧F` / `Ctrl+Shift+F` to toggle feedback; `⌘Enter` / `Ctrl+Enter` to submit
  the existing popup. Typing, IME composition, previews and unsaved drafts are protected.
- Optional owner action buttons above the expanded toolbar. The runnable demo
  connects **Edit text** to Tiptap and **Drawesome** to its original studio pen tray.
- Original click/multi-select drag and rectangle-only toggle remain available.

No portfolio content, private comment data, account, filesystem path, token or
authoring endpoint is included.

## Run from this branch

Node 20.19+ is recommended. In a clone of this repository:

```sh
git switch review-workbench
npx --yes pnpm@10.34.9 install --frozen-lockfile
npx --yes pnpm@10.34.9 --filter agentation build
npx --yes pnpm@10.34.9 --filter @agentation-fork/review-workbench demo
```

Open `http://127.0.0.1:4192/`. The demo is browser-only by default; text/drawings
are saved in its browser storage, **not your project files**. Only sample content
is provided. Storage denial or another tab changing the sample keeps edits open
with an error. Cancel/Escape asks before discarding an unsaved edit.

To send comments to your own coding agent, separately run/configure its Agentation
MCP server and open `http://127.0.0.1:4192/?endpoint=http://127.0.0.1:4747`.
Do not start a second server on a port already in use. The demo only accepts
loopback HTTP endpoints. An active toolbar or server does not prove delivery:
add an identifiable test note and ask your agent to read that exact note/page.
Only clean up your own test note. Server persistence depends on its configuration.

`npm install agentation` still installs upstream, not this extension.

## Reuse in a React app

Build with `pnpm --filter @agentation-fork/review-workbench build` and use this local
package from your workspace (or copy this extension with its license notices).
Mount **one** Workbench instead of a second `<Agentation>`:

```tsx
import {ReviewWorkbench} from '@agentation-fork/review-workbench';

<ReviewWorkbench
  enabled={process.env.NODE_ENV === 'development'}
  endpoint="http://localhost:4747"
  isOwnerBusy={() => editor.hasUnsavedChanges || editor.isSaving}
  ownerActions={isAuthorizedOwner ? [
    {id:'edit', label:'Edit text', run:() => editor.openText()},
    {id:'draw', label:'Drawesome', run:() => editor.openDrawing()},
  ] : []}
/>
```

`ownerActions` are **integration callbacks, not an installed CMS**. The demo
contains concrete Tiptap/Drawesome wiring; production sites must supply their own
content model, rendering and authorized storage adapter. No arbitrary DOM/HTML is
rewritten and no project files are written by this extension. Hide/remove owner
tools in reader builds, verify permissions **on the server**, validate inputs,
check versions to prevent overwrites, and preserve a previous version. A browser
boolean or loopback hostname is not an authorization system for a hosted app.
Nothing is automatically deployed, edited, deleted or marked applied by an AI.

By default, Comments only reads sessions matching this origin and path. To list
more pages, pass `scope={url => ['/','/work'].includes(url.pathname)}`. The origin
check cannot be disabled. This filter is not access control: protect a remote
annotation service separately. `agentationProps` preserves callbacks/options,
except endpoint and shortcuts are managed by the Workbench. One toolbar is
supported per document; changing the mount key on route changes is recommended.
Hash-route storage is not supported by this extension yet. Saved legacy custom
portfolio rectangles are not migrated; standard Agentation area/rectangle notes
remain usable through their numbered markers.

## Validation / limitations

```sh
npx --yes pnpm@10.34.9 --filter @agentation-fork/review-workbench test
npx --yes pnpm@10.34.9 --filter @agentation-fork/review-workbench typecheck
npx --yes pnpm@10.34.9 --filter @agentation-fork/review-workbench build
npx --yes pnpm@10.34.9 --filter @agentation-fork/review-workbench demo:build
```

See [VALIDATION.md](VALIDATION.md) for actual checks, failures and untested areas.
The fork branch is a review candidate, not an upstream release or a production
security certification. The original toolbar's desktop support limits still apply.
No independent reviewer or physical-device validation is implied.
The original repository's documentation/MCP dependencies have unresolved audit
alerts recorded in VALIDATION.md; do not treat this source upload as approval to
deploy them to the internet.

## Licenses

The extension remains under the repository's **PolyForm Shield 1.0.0** license;
retain the root license and notices. Agentation is by Benji Taylor. The demo's
Tiptap and Drawesome dependencies retain their own MIT licenses; see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Do not relabel the fork as MIT.
