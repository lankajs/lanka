# Maintaining `@lankajs/browser`

Platform capabilities: cookies across the two APIs an engine might have, and a
release guard over the caches the framework itself creates. Small, and almost
entirely about environments that are not the one you are testing in.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports nothing from this repository. The release guard's default
  `dropCaches` walks Cache Storage generically rather than knowing about
  `@lankajs/blob-cache` — a module must not import another module.
- It decides nothing on the application's behalf. The guard returns an outcome;
  the application acts.

## Invariants

1. **Every cookie method is async, on both APIs.** The modern `cookieStore` is
   async and `document.cookie` is not; exposing that difference would make every
   caller ask which engine it got.

2. **Without a browser, everything degrades quietly.** `set` does nothing, `get`
   answers `null`, `isEnabled()` is `false`. SSR and node tests must not need a
   guard around each call.

3. **`navigator.cookieEnabled` is read inside a `try`.** Some environments throw
   on the access itself.

4. **The release guard answers, never acts.** Reloading is the commonest response
   and the worst default: a visitor mid-form would lose it. `TLankaReleaseOutcome`
   exists so the application decides.

5. **Not knowing is not a release.** An unreadable version returns `"unknown"`
   and drops nothing. The alternative empties the caches on every failed request.

6. **The guard cannot throw.** The whole body is contained: a guard that took
   down start-up because it could not read a cache is worse than the staleness it
   prevents.

7. **`readVersion` is required and has no default.** A framework cannot know the
   bundler, and a guessed default would be silently wrong in the builds it
   guessed wrong about.

8. **`memory`, `dropCaches` and `report` are all replaceable.** That is what
   makes the guard testable without a browser and usable by an application with
   its own storage.

## Tests and coverage

Beside each unit, plus the `_playground/` scene.

Coverage is a ratchet: statements 83, branches 75, functions 80, lines 83 — the
lowest floors in the repository, because whole branches exist only on engines
jsdom does not emulate. Raise them by injecting the capability rather than by
excluding the file: the `cookieStore` path is reachable by defining the global on
a fake `window`, and every part of the guard is a parameter.

Both API paths of every cookie method deserve a test. A change verified on only
one of them is a change verified on half the engines.

## Before you finish

```bash
pnpm --filter @lankajs/browser test
pnpm --filter @lankajs/browser test:coverage
pnpm check
```

## Traps

**Adding a capability because it is "browser stuff".** This package is not a
junk drawer. Two things live here because the framework itself creates the
problem they solve. A third needs the same argument.

**Making the guard reload, retry, or notify.** All three are application
decisions, and all three have been the wrong default somewhere.

**Reading a global at module scope.** `isBrowser` and `useCookieStore` are
instance fields for a reason: a module-scope read runs on import, in node.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
