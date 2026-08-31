# @lankajs/plugin-prefetch

**⬡ plugin** · Network priority ladder

> SSE > request > route chunk > prefetch — a rule the code enforces.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin) · the instance's observable in-flight counter
```

## Contents

- `LankaIntentPrefetch` — short-lived buffer: claim, freshness fences, TTL, eviction
- `LankaChunkPreload` — chunk sweeping with its own counter and expirable gates
- `LankaDataWarmup` — batched data warm-up with a ceiling on waiting for silence

## The ladder

```
SSE  >  ordinary request  >  route chunk  >  data warm-up  >  intent buffer
```

## Three tiers, three counters — not duplication

The request counter lives in core: there is one send point and the accounting belongs
there. The chunk counter lives here because a chunk is pulled by a dynamic `import()`
and is invisible to the request layer; without it, data warm-up would read the wire as
quiet mid-sweep and "code first, then data" would rest on a head start rather than a gate.

The intent buffer counts its OWN in-flight requests and SUBTRACTS them from the total.
Without that it would see its own request as foreign traffic after the first warm-up and
stop itself — permanently and silently.

The tiers also differ by consumer: data warm-up must yield to chunks, the intent buffer
must not. It fires on a confirmed gesture toward a known screen and DISCARDS rather than
defers; letting a speculative background chunk suppress it would trade a certain win for
a guess.

## Every gate is escapable

Gates EXPIRE, waiting for silence has a CEILING, and a platform that never reported its
visibility is not believed. An absolute gate switches the service off forever on one
unlucky moment: a pause whose release never arrives, a connection read as slow in the
one second that mattered, a start before the router published its routes — all invisible
in a desktop browser and ordinary inside a mobile client.

## A buffer, not a cache

Entries live seconds and are read once, so there is no invalidation bus and no way to
get it wrong. A live event always beats a warmed copy, through domain fences counted by
a COUNTER rather than a list of touched entities: guessing which entry went stale is
exactly the guess that cannot be made safely. A redundant invalidation costs one
ordinary request.

---

Repository map: [../../README.md](../../README.md)
