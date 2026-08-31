# Maintaining `@lankajs/host`

Two halves of one seam: a scope that gives one unit of server work its own
framework instance, and one call that turns fetched data into a screen's first
state. Nothing here renders, routes or caches.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before — the seam it uses,
  `setLankaRuntimeResolver`, has core shipping no resolver and knowing of none.
- The seam is **not a sixth extension point.** The five doors in
  `skills/surface/SKILL.md` §4 are how core knows a PLUGIN — something core calls
  during its own work. This is installed by a module before any plugin exists,
  and it replaces an answer rather than adding a call, which is why it lives in
  the `internal` tier beside the pointer it replaces.
- It may import `lanka` and nothing else from this repository. No module imports
  another module.
- `node:async_hooks` may appear ONLY in files reachable from `src/server.ts`. The
  root entry is browser code; `check:runtime` reads the import graph of each
  entry against the environments declared for that entry in the registry.

## Invariants

1. **The resolver is the whole answer, with no fallback.** `getActiveRuntime()`
   consults the installed resolver and does not consult the module pointer behind
   it. A fallback would turn "this ran outside a scope" from a named failure into
   one request quietly reading another request's instance — the exact defect the
   package exists to prevent.

2. **The store enters `AsyncLocalStorage` before the instance exists.** The store
   is a mutable box, filled immediately after `createLanka` returns and before
   plugins install or bootstrap runs. Both of those reach for ambient facades; a
   store written after them resolves to nothing and start-up fails.

3. **`startLanka` is written out rather than called.** The instance must be put
   in the store BETWEEN its two steps. If `startLanka` ever grows a step, this
   copy has to grow it too — that is the price of the previous invariant, and it
   is cheaper than a scoping option inside core.

4. **The instance is disposed in `finally`, including on a throw.** A server
   keeping one instance per request alive keeps its scopes, subscriptions and bus
   with it: a leak measured in requests per second.

5. **`runLankaStatic` refuses headers twice** — in the type (`headers?: never`)
   and at runtime. Types do not protect a JavaScript caller, and the failure being
   prevented is a shared file carrying one reader's session. This is the one place
   here that throws on misuse rather than degrading.

6. **A forwarded header never overwrites one the gateway set.** Whoever wrote the
   call knew something this does not — a service token, another tenant, a
   deliberately anonymous request.

7. **The forward list is an allow-list of identity headers.** `host`,
   `content-length` and `accept-encoding` describe the browser's connection to the
   host framework, not the framework's connection to the API. Adding "everything"
   produces requests that are wrong in ways that take an afternoon to find.

8. **`hydrateLankaVM` applies once and never throws on a second call.** React
   renders twice in StrictMode; a throw would be a crash that only reproduces in
   development. A differing second snapshot warns in development only.

9. **No cache, no router, no renderer, ever.** Every host this package exists for
   ships all three. See `skills/hosts/SKILL.md` §5.

## What to run

```bash
pnpm --filter @lankajs/host test          # units and the playground scene
pnpm --filter @lankajs/host test:coverage # thresholds are at 100 and stay there
node scripts/check-runtime.mjs          # per-entry environments, both entries
```

The playground scene is the one that matters: it renders a screen from server
data and asserts the browser asked the API for **nothing**. A unit can prove each
half; only the scene proves the seam.
