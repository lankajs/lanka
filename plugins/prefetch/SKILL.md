# Maintaining `@lankajs/plugin-prefetch`

Three tiers of speculative work — intent buffer, chunk sweep, data warm-up — over
three counters, arranged so that none of them can slow down what the user is
waiting for.

Every rule in this package is a form of one sentence: **prefetch may be useless,
but it may never be in the way.**

## Boundary

- A **plugin**: core calls it. `lanka` is a **peer dependency**, always
  `workspace:^`.
- It knows no route, no resource and no router. The manifest, the resources and
  the exclusions all arrive from the application.
- `@lankajs/plugin-prefetch/router` is a separate subpath so that a consumer who
  does not sweep chunks does not pull the manifest shape.

## Invariants

1. **The priority ladder is fixed**: SSE > ordinary request > route chunk >
   prefetch. Prefetch yields by resource (a warm-up is not sent while another
   request is on the wire) and by correctness (a live event beats a warmed copy).

2. **A declined warm-up is DISCARDED, not deferred.** A deferred one arrives
   after the navigation it was meant to serve, having cost the wire anyway.

3. **There is no queue, no lock and no retry in this package.** Each would let
   prefetch block something above it on the ladder.

4. **The intent buffer is a buffer, not a cache.** Read by a loader only, each
   entry exactly once, entries living seconds. That is why there is no
   invalidation bus: a missed event cannot make a value stale when the value does
   not outlive the gesture that ordered it. Any change that lengthens an entry's
   life turns it into a cache and requires the whole invalidation story.

5. **Every claim has a complete fallback.** Disabling the service must leave
   behaviour exactly as it was. A path where a claim is required is a path where
   a bug in this plugin becomes a broken screen.

6. **The fence is compared as of SENDING, not as of the response.** A response
   describes the world as the server read it, so an event at any point after
   sending makes it suspect.

7. **A resource's `fetch` is bare.** No ViewModel write, no loading flag, no
   error, no analytics. The user did not open this screen and may never open it.

8. **A warm-up task must declare `keptFreshBy`.** A payload nothing refreshes
   must not be warmed: warmed and stale is strictly worse than a skeleton,
   because the user acts on old data instead of waiting for correct data.

9. **Chunk loading is the chunk only, never the router's `preloadRoute`.** That
   runs `beforeLoad` and the loader, which seed state, send analytics and call
   the server — producing phantom screen views and a corrupted funnel.

10. **Three counters, and the intent buffer subtracts its own.** Core counts
    requests; this package counts chunks, because a chunk is pulled by a dynamic
    `import()` and never passes the request layer; and the buffer subtracts its
    own in-flight requests, or it would see its own traffic as foreign and stop
    itself.

11. **Counters are wired lazily, through a closure.** The framework instance
    arrives in `install` while the tiers are constructed before it; reading the
    counter in a constructor reads it once and forever.

12. **Removing the plugin clears the buffer.** It holds one user's server
    responses, which must not outlive the framework instance.

13. **Clock, scheduler, network and visibility are all injected.** That is what
    makes the ladder testable without a browser and without fake timers.

## Tests and coverage

Beside each unit, plus the `_playground/` scene that drives all three tiers with
a busy wire in the middle.

Coverage is a ratchet: statements 99, branches 96, functions 91, lines 99.

What to pin, because each is an invariant above: a warm-up declined while the
wire is busy (and _not_ queued), a claim after a fence bump returning nothing, a
second claim of one entry returning nothing, an expired entry, and the diagnostic
counters matching the events that produced them.

## Performance

`lankaPrefetch.bench.ts`; baseline in `perf/prefetch.perf.md`, in yardsticks. The
buffer's own bookkeeping is what is measured — not the fetches, which are the
application's.

## Before you finish

```bash
pnpm --filter @lankajs/plugin-prefetch test
pnpm --filter @lankajs/plugin-prefetch test:coverage
node scripts/check-api.mjs           # two subpaths
node scripts/check-publishable.mjs
pnpm check
```

## Traps

**Adding a retry to a warm-up.** See invariant 3. A failed warm-up is a
non-event; the claimer's fallback covers it.

**Extending the TTL "so the buffer is more useful".** See invariant 4. Past a few
seconds you have built a cache with no invalidation.

**Letting a resource write state on `fetch`.** It will overwrite the screen the
user is on, and only when two screens are warm at once — which is exactly the
case nobody tests by hand.

**Making `keptFreshBy` optional for convenience.** It is the one field that
prevents a whole class of "the app showed me yesterday's data" reports.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
