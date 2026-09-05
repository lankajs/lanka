# 13 — What a consumer can test, and what a developer can see

Two halves of one complaint: the framework collects more than it shows, and it
hands a consumer fewer tools to test their own application than its own suite
uses.

Both are surface work. `skills/surface/SKILL.md` owns every decision here, and
the three costs of admission — a scene, a line in `api/`, a shape that absorbs
its own future — apply to every new name below.

## The defects this plan closes

1. **`stoppedBy` is documented and never populated.** `plugins/devtools/GUIDE.md`
   says it "tells you which middleware stopped an event". The collector records
   an event from inside its own bus middleware, which runs BEFORE any middleware
   that could stop it; `LankaEventBusInstance.markStopped` writes onto the last
   entry of the bus's event log, which is off by default. There is no path by
   which the field is ever set. It is the clearest kind of documentation defect:
   a promise a reader can act on and never receive.
2. **One fake transport answers every endpoint.** `createLankaFakeTransport`
   takes one `body` and one `status`. A test of a screen that reads two endpoints
   cannot use it, so consumers write the twenty-line double the kit exists to
   prevent — the exact divergence `tools/testing/SKILL.md` names as a trap.
3. **Nothing in the kit asserts an event.** The scenario layer is the framework's
   distinguishing feature, and the kit can only double a scenario the test
   injected itself. "Did dispatching this make that fire" has no answer in it.
4. **Nothing in the kit waits.** Every consumer test of a gateway-backed screen
   ends in a hand-rolled `await new Promise((r) => setTimeout(r, 0))`, repeated
   until it passes.
5. **The inspector sees three sources and the wire is a single integer.** Which
   request, how long it took and whether it failed are not collected at all,
   though `useRequestMiddleware` sits open and wraps every request.
6. **The panel polls.** `setInterval(render, 500)` — a redraw twice a second
   whether or not anything changed, and a half-second lag when it did.

## What is NOT in this plan, and why

- **A storage double in the kit.** `@lankajs/tool-testing` depends on `lanka`
  alone. A double over `@lankajs/storage`'s port would make a tool depend on a
  module, which inverts the direction the whole repository is arranged in. It
  belongs in `modules/storage/src/_testing/`, and is its own piece of work.
- **A ViewModel double.** `tools/testing/SKILL.md` invariant 6, unchanged: the
  ViewModel is the subject, and what it needs from outside arrives as parameters.
- **An export for "the session as JSON".** `JSON.stringify(getSnapshot())` is
  already the whole feature. The panel gets a copy button; the facade gets no
  name for it.

---

## Phase 1 — the kit learns to route, record and wait

`tools/testing/`, no other package. Everything here is additive: existing calls
keep their behaviour, per `skills/surface/SKILL.md` §6d.8.

### 1.1 `createLankaFakeTransport` answers per endpoint

`ILankaFakeTransportConfig` gains one optional field:

```ts
routes?: readonly ILankaFakeTransportRoute[];
```

```ts
export interface ILankaFakeTransportRoute {
	/** Which requests this answers: a substring, a pattern, or a predicate. */
	match: string | RegExp | ((endpoint: string, options: RequestInit | undefined) => boolean);
	body?: unknown;
	status?: number;
	failWith?: () => Error;
	/** Answer this way at most N times, then fall through. */
	times?: number;
	/** Answer after this long — for asserting a loading state. */
	delayMs?: number;
}
```

First matching route wins; nothing matches, the top-level `body` / `status` /
`failWith` answer as they do today. A test written before this phase behaves
identically, which is what makes the field safe.

`ILankaFakeTransport` gains `callsTo(match)`. The framework implements that
interface, so adding a member is safe (§6b).

### 1.2 `createLankaFakeScenario` records what it emitted

`ILankaFakeScenario<TData>` gains `emitted: readonly TData[]`. A test asserting
the PAYLOAD a ViewModel published has to wrap `emit` by hand today.

### 1.3 `createLankaEventRecorder(lanka)` — the missing assertion

```ts
const events = createLankaEventRecorder(lanka);
app.completeTodo(1);
expect(events.of("todo.completed")).toEqual([{ id: 1 }]);
await events.waitFor("todo.synced");
events.stop();
```

Returns `ILankaEventRecorder`: `all`, `of(eventType)`, `count(eventType)`,
`waitFor(eventType, { timeoutMs })`, `clear()`, `stop()`.

Built on `lanka.eventBus.addMiddleware`, and it returns `"pass"`
unconditionally — for the same reason the inspector does: a recorder able to stop
delivery would make observing a test change what the test observes.

`waitFor` REJECTS on its deadline, with the event type in the message. A helper
that resolves late and silently is how a suite acquires tests that pass without
the thing having happened.

`stop()` removes the middleware. The setup file's `resetLanka` already disposes
the instance, so a forgotten `stop()` cannot leak across files — but a recorder
whose middleware outlives its test within one file would count a neighbour's
events, so `stop` exists and the guide says to call it.

### 1.4 `createLankaLogRecorder()` — asserting a warning

A sink over `lankaLogger`, returning `ILankaLogRecorder`: `lines`, `of(level)`,
`stop()`. "The framework warned about X" is asserted today by spying on
`console`, which pins the logger's formatting rather than its decision.

### 1.5 `waitForLankaIdle(lanka, { timeoutMs })`

Resolves when the in-flight counter reads zero AND the microtask queue has
drained; rejects on the deadline, naming the count still outstanding. This is the
helper that removes the most lines from a consumer's suite, and the one most
likely to be written wrong by hand — a bare `await Promise.resolve()` drains one
level of microtasks, not the chain a gateway call produces.

### 1.6 `registerLankaFakes(lanka, fakes)` and `renderWithLanka({ fakes })`

```ts
renderWithLanka(<TodoScreen />, { fakes: { gateways: { TodoGateway: fake } } });
```

Today that is a `setup` callback with a `registerInstance` line per double, and
the locator method's name is mechanism a consumer should not have to learn. The
`setup` option stays and still runs — after the fakes, so a test can do both.

`registerLankaFakes(lanka, fakes)` is the same call without React, for a test
with no component in it.

### 1.7 The forms these take

None of the seven is a ROLE (`skills/parity/SKILL.md` §1: a role is what a
consumer writes MANY of). They are things a test holds one of, so they are
factories returning an interface — `skills/forms/SKILL.md`, row 2 — and get no
class-style pair. `waitForLankaIdle` and `registerLankaFakes` are operations on
plain arguments, so they are verb-first functions.

### 1.8 What this phase must leave green

- A scene per new name in `tools/testing/_playground/` — surface canon §2, and
  `check-api` fails without one.
- `api/tool-testing.api.md` regenerated; its diff IS the review.
- The coverage ratchet held (statements 92, branches 87, functions 68, lines 92).
  New code raises the floor; it never lowers it.

---

## Phase 2 — core: the bus reports the outcome of a dispatch

The smallest change that makes defect 1 fixable, and it cannot be fixed anywhere
else: a middleware cannot see a decision taken by a middleware after it.

### 2.1 The shape

```ts
/** What became of one dispatch, after the whole chain has run. */
export interface ILankaEventBusOutcome {
	eventType: string;
	/** Delivered, stopped by a middleware, or invalid by the event's schema. */
	outcome: "delivered" | "stopped" | "invalid";
	/** How many subscribers received it. Zero unless delivered. */
	subscribers: number;
	/** Which middleware stopped it, when one did. */
	stoppedBy?: string;
}

export type TLankaEventBusObserver = (outcome: ILankaEventBusOutcome) => void;
```

`lankaEventBus.addObserver(observer)` and `.removeObserver(observer)`, mirrored
on the instance. A union rather than an `enum` (§6d.5) and one object rather than
positional arguments (§6d.9), so both can grow.

The symmetry is deliberate: a middleware returns a `Decision`, the bus reports an
`Outcome`. An observer cannot decide anything — the property that keeps
`plugins/devtools/SKILL.md` invariant 3 true by construction rather than by
discipline.

### 2.2 The extension point registry

`useRequestMiddleware`, `inFlight`, `addMiddleware`, `addSink`, `use(plugin)` —
and now a sixth, `lankaEventBus.addObserver`, declared WITH its first occupant
(`plugins/devtools`) and not before, per surface canon §4. Phase 3 is that
occupant, so phases 2 and 3 land together or neither does.

### 2.3 The measurement this phase owes

`dispatch` is a hot path. An observer list iterated on every dispatch is a cost
paid by every application whether or not anything observes, so:

- the loop is skipped on an empty list — one length check;
- `pnpm run check:perf`, on an idle machine, before and after;
- the number goes in the commit, and `perf/core.perf.md` moves only if it
  improved (`skills/gates/SKILL.md` §1 — ratchets only tighten).

If the empty-list case measures worse than the yardstick allows, this phase is
wrong, and defect 1 is closed instead by DELETING `stoppedBy` from the snapshot
and the guide. That is the fallback and it is an acceptable outcome: a field that
never fills is worse than a field that never existed.

---

## Phase 3 — the inspector collects what it already had access to

### 3.1 `stoppedBy` becomes true

The collector observes outcomes (phase 2) instead of guessing from its own
middleware. `ILankaDevtoolsEvent` gains `outcome`, and `stoppedBy` fills for the
first time. The middleware stays — it is what dates the event — and still
returns `"pass"`.

### 3.2 Requests, not a counter

`plugins/devtools` becomes the second occupant of `useRequestMiddleware`
(`plugins/http` is the first; `inFlight` already has two, so a shared point is
established practice here).

```ts
interface ILankaDevtoolsRequest {
	at: number;
	endpoint: string;
	durationMs: number;
	outcome: "ok" | "failed";
	error?: string;
}
```

Bounded by `maxRequests` (100). It wraps `next` in `try` / `finally` and rethrows
untouched — the inspector observes and does not decide, in the second place that
rule now has to hold.

### 3.3 Scenarios

`ILankaDevtoolsSnapshot` gains `scenarios: readonly { eventType, subscribers,
dispatches }[]`, read from `lanka.eventBus.getRegisteredEvents()` plus what has
been recorded. This is the data the package's own barrel docblock says is
"collected and shown to nobody", and the only one of the three still unshown.

Not from the bus's replay buffer — invariant 4 of the package's SKILL, unchanged
and load-bearing: reading it would make the inspector depend on a leak.

### 3.4 `subscribe(listener)`

On the collector and on the plugin. Fires when something is recorded, coalesced
to one notification per frame, so a burst of events cannot make redrawing the
panel the reason the application is slow.

### 3.5 `exposeAs`

`lankaDevtools({ exposeAs: "__lankaDevtools" })` puts the plugin on `globalThis`
under that name, in development only, and removes it on teardown. A string and
not a boolean: `expose: true` cannot grow a second question (§6d.2), and a name
is what a console user actually needs to know.

---

## Phase 4 — the panel grows, and the canon says why

`plugins/devtools/SKILL.md` lists "letting the panel grow" as a trap and says a
real inspector UI belongs in a consumer's debug screen. That decision is being
reversed deliberately, and the reversal is written down with its reason rather
than left as a contradiction between a file and the code beside it.

**Why it is being reversed.** The trap it guarded against was a package acquiring
a view-library dependency and a product surface. Neither is what a filter box
costs. What the old rule actually produced was a panel nobody used —
`getSnapshot()` in a consumer's own debug screen is a project nobody starts while
debugging — so the data stayed unread, which is the defect the package exists to
fix.

**What replaces it, so the concern survives.** Three invariants that still hold,
and one new bound.

1. No view-library dependency, ever. Plain DOM.
2. Nothing renders outside development, before doing any work.
3. The panel reads a snapshot and writes nothing back into the framework.
4. NEW — the panel is a playground-driven surface like any other: every control
   it grows is exercised by a scene, and its composition budget is recorded
   rather than uncapped.

### 4.1 What it gains

- Tabs: events, logs, requests, scenarios.
- A filter box, matching against the row's text.
- Clear, and copy-as-JSON.
- Collapse to a title bar.
- Redraw on `subscribe`, not on a timer — defect 6.

### 4.2 The shape it takes

`renderLankaDevtoolsPanel` keeps its signature and gains an options object
(`{ container, tab, collapsed }`). The current second positional `container`
parameter stays accepted, because §6c forbids removing it.

Its internals split by structure rule 1: one runtime export per file, the panel's
parts under `plugins/devtools/src/panel/`, each small enough for the 40-line
default budget. A single 200-line render function would fail `check-composition`
and would deserve to.

---

## Phase 5 — the generated half, and the harvest

- `node scripts/check-api.mjs --write` for all three packages; read the diffs.
- `node scripts/scaffold.mjs` for anything the registry now says differently
  (`entries`, `contains`, `socket`).
- `GUIDE.md` for both packages, by hand — they are not generated.
- `<pkg>/skills/lanka-<slug>/SKILL.md` by hand, `reference.md` regenerated: what
  a CONSUMER's agent is told about testing a lanka application changes materially
  here.
- `llms.txt`, and the `CLAUDE.md` / `AGENTS.md` mirror if the router changed.
- Changesets: `lanka` minor, `@lankajs/plugin-devtools` minor,
  `@lankajs/tool-testing` minor.

**Harvest before deleting this plan:**

| Fact                                                                    | Goes to                                      |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| Why the bus reports an outcome instead of widening middleware           | a comment beside `addObserver`               |
| Why the panel rule was reversed, and the four invariants that replace it | `plugins/devtools/SKILL.md`                  |
| Why the kit has no storage double                                       | `tools/testing/SKILL.md`, beside invariant 6 |
| Why `waitFor` rejects rather than resolving late                        | `tools/testing/SKILL.md`, a new invariant    |
| The sixth extension point and its occupant                              | `skills/surface/SKILL.md` §4 table           |
