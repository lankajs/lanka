# Maintaining `@lankajs/host`

Two halves of one seam: a scope that gives one unit of server work its own
framework instance, and one call that turns fetched data into a screen's first
state. Nothing here renders, routes or caches.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before — the seam it uses,
  `setLankaRuntimeResolver`, has core shipping no resolver and knowing of none.
- The seam is **not a seventh extension point.** The six doors in
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

## Tests and coverage

Beside each unit, plus the playground scene in `_playground/` — and the scene is
the one that matters: it renders a screen from server data and asserts the
browser asked the API for **nothing**. A unit can prove each half; only the scene
proves the seam.

The scope tests must run something CONCURRENTLY. A scope that leaks is invisible
to a suite that starts one request at a time, which is the shape a hand-written
test takes by default.

Coverage thresholds are at 100 on every axis and stay there. Add the missing
test; never lower one.

## Before you finish

```bash
pnpm --filter @lankajs/host test
pnpm --filter @lankajs/host test:coverage
node scripts/check-api.mjs
node scripts/check-runtime.mjs
pnpm check
```

`check:runtime` is not optional here. This is the one package whose two entries
run in different environments, and it is the gate that reads the import graph of
each against what the registry declares.

## Traps

**Adding a fallback to the resolver.** It turns "this ran outside a scope" from a
named failure into one request quietly reading another request's instance — the
exact defect the package exists to prevent.

**Importing `node:async_hooks` from a file the root entry can reach.** The root
entry is browser code; the server half is reachable only from `src/server.ts`,
and `check:runtime` is what says so.

**Widening the forward list.** It is an allow-list of identity headers on
purpose; "everything" produces requests that are wrong in ways that take an
afternoon to find.

**Calling the seam a sixth extension point and treating it like one.** It
replaces an answer rather than adding a call, which is why it lives in the
`internal` tier beside the pointer it replaces.

**Adding a cache, a router or a renderer.** Every host this package exists for
ships all three; see `skills/hosts/SKILL.md` §5.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)

## The one section proved by a single host

§ Nitro in `GUIDE.md` is written as common ground between two hosts — Nuxt and
SolidStart — and only Nuxt exists. SolidStart is not built: `@solidjs/start@2`
needs `vite: ^8 || ^9` and this repository is on `^7`, and the price of moving
is `vitest` 3→4 across every project rather than anything about SolidStart. The
ecosystem stopped being the blocker when vite 8 shipped; the runner major did
not.

So that section is general by ARGUMENT and not by demonstration, which is worth
knowing before editing it: a reader treating it as proved will take Nuxt's
shape for Nitro's. The second host is what would separate them.
