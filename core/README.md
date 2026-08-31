# lanka

**◆ core** · Core

> Ten subsystems, two peer dependencies, five extension points.

One, unscoped. Everything depends on it; it depends on nothing.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension points core declares

| Point | What it gives | Available |
| --- | --- | --- |
| `useRequestMiddleware(mw)` | wrap every request | yes |
| `inFlight.subscribe(fn)` | observe the number of requests on the wire | yes |
| `lankaEventBus.addMiddleware` | intercept bus events | yes |
| `LankaLogger sinks` | where log output goes | yes |
| `use(plugin)` | register a whole plugin | yes |

The list is closed on purpose. Each point is a public contract for the lifetime of a
major version, so anything that can be a module must be a module.

## Subsystems

Flat, with no intermediate `Layers/`: **folder = subpath in `exports` = line in this list.**

Each subsystem is exported through its BARREL (`index.ts`), so public is exactly what the
barrel lists, moving a file inside a subsystem is not a breaking change, and a consumer's
import reads `lanka/gateway`.

`internal/` is not in the map — that is what may be refactored without a major. Hence the
rule: a primitive a neighbouring package needs has two honest exits, becoming public here
or moving to the neighbour. `src/publicSurface.test.ts` checks the map, the barrels and
the seal on `internal`, and catches a subsystem added as a folder and forgotten in
`exports`.

- `src/bootstrap/`
- `src/role/`
- `src/config/`
- `src/locator/`
- `src/gateway/`
- `src/validation/`
- `src/mock/`
- `src/errors/`
- `src/scenario/`
- `src/viewmodel/`
- `src/logger/`
- `src/internal/` — **not exported.** Refactored without a major.

## Instance

```ts
const lanka = createLanka({ host, flags });
await lanka.bootstrap({ services });
```

The instance owns all framework state: the bus, the scenario registries, four locator
caches, the config and the in-flight request counter. Module-level state made three
things impossible, none of which looked like a bug: two apps in one process shared a
bus, SSR reused state between different users' requests, and test isolation rested on a
global `beforeEach` reaching into internal registries.

**Ambient facades** — `lankaEventBus.dispatch`, `lankaSingletons.foo`, `getLankaFlags()`,
`lankaHttpInFlight` — resolve THE ONE active instance (`internal/activeRuntime.ts`).
They exist for callers that cannot hold an instance: a user-extended `ALankaScenario`,
the static `LankaScenarioBootstrap`, a module package with no instance in scope.
Isolation belongs to the instance holder; a facade cannot offer it.

One thing stays at module level deliberately: `ALankaScenario` collects constructed
scenarios into a static pool. That is not runtime state but a REGISTRY OF DEFINITIONS —
the classes come from one `@lanka_di/Scenarios` barrel and both instances must see the
same list. Splitting it would be divergence, not isolation.

## Failure

`LankaError` carries a TAGGED kind: `network` · `timeout` · `aborted` · `http` · `schema` ·
`domain`. Six rather than one, because each demands something different of the interface:
a network failure invites a retry, an aborted request is not shown at all (the user left),
a schema break is reported as a break rather than as the user's fault.

The kind is assigned where the failure is born: in `ALankaRequest.execute`, the single
point every request passes through.

Parsing a particular response body format is NOT here: which JSON the backend sends is
policy, and policy lives in `@lankajs/plugin-http`.

## Host contract

```ts
interface ILankaHost {
	apiBaseUrl: string;
	httpErrorMessage(status: number): string;
	networkErrorMessage(): string;
	timeoutErrorMessage(): string;
}
```

All required, and that is the choice: a forgotten field is a compile error in the one
place it can be passed, rather than a wrong-language string in the interface or an
`undefined` inside a request URL. `ALankaGateway.endpoint()` prefixes with `apiBaseUrl`.

### Request middleware shape

**Request middleware is a WRAPPER, not a set of hooks.** The `(ctx, next) => …` shape,
because retry cannot be expressed with `onRequest`/`onResponse`/`onError`: `onError` can
replace an error but cannot run the request again — and retry plus auth refresh are the
two main abilities of a request-policy plugin. Registered first wraps the rest.

The objection to `next()` that holds for the event bus does not carry over: there a
middleware that skips `next` SILENCES the event, here it returns a value instead of a
request, and the caller sees it.

**Cancellation and timeout.** `execute` takes `signal` and `timeoutMs`; the default
timeout is per instance. The framework combines the caller's signal and its own timer
into ONE signal and still distinguishes who aborted: a timed-out request yields `timeout`
and is shown, a caller-aborted one yields `aborted` and stays silent. `AbortSignal` does
not distinguish them — it has one `abort` for everyone.

## Response body validation

The port accepts ANY schema implementing Standard Schema: zod 4, valibot, arktype. An
abstraction typed by its single implementation is not an abstraction; the proof is a
second implementation passing the same assertions, and it is in the tests.

There are no adapter classes: a schema describes itself. The app chooses the library —
`@lankajs/zod`, `@lankajs/valibot`, or neither, working with schemas directly.

An async schema is rejected LOUDLY. Standard Schema allows `validate` to return a
promise, a synchronous port cannot await it, and answering "fine" would let unvalidated
data through — a check that cannot fail reporting success.

## Lifetime

`lanka.createScope()` gives a lifetime shorter than the application's: an object created
in a scope goes away with it.

A scope takes only ITS OWN objects. One that took others' would be more dangerous than no
scopes at all: closing a screen would break the app. Resolving from a closed scope is
rejected loudly — it is almost always a reference that outlived its screen.

A lazy ViewModel has `dispose()` for the same reason: it subscribes to scenarios on first
use, and without explicit disposal the subscription outlives the screen that created it.

## Access-tracking blind spot

A consumer re-renders only for keys it READ through the proxy. An action computing a
value via `get()` reads state past the proxy — so a component whose only link to a key
goes through such a getter never re-renders: the screen freezes and there is no error.

It cannot be fixed in the view: destructuring "for the side effect" reads as dead code and
the next refactor or lint autofix removes it. The fix is
`enableAccessTrackingOptimization: false`, and so that nobody has to remember it, in
development the mismatch announces itself: the framework sees that a key changed, that no
re-render will follow, and that the component reads that key through a getter — and warns
with the ViewModel and key names.

The trap stays silent on healthy code: not reading what you do not need is the work
tracking exists for.

## Event bus

**Buffering on request only.** Buffer depth is the maximum of what the event declares
(`registerEvent({ replay: N })`) and what subscribers ask for; when the last asker
unsubscribes the buffer is cleared. Buffering every payload unconditionally holds
personal data in memory with no consumer at all.

**`replay` counts values:** `false | "last" | N`, where `true` means "last".

**`subscribe` returns an unsubscribe.** It removes EXACTLY that subscription: by callback,
two subscriptions of one function are indistinguishable.

**Delivery iterates a COPY of the subscriber list.** A subscriber may unsubscribe inside
its own handler, and unsubscribing splices the same array, so iterating the original
skipped a neighbour silently. The deliberate side effect: subscribing during delivery
waits for the next event.

**`registerEvent` merges metadata** instead of recreating state; recreating dropped every
subscriber silently.

**Middleware returns a decision** — `"pass"` or `{ stop: reason }`. A `next()`-based shape
means not calling it makes the event vanish SILENTLY: a mechanism that exists for
observability would be its own blind spot. A stop is written to the event log and is
visible to the inspector. An exception in middleware is treated the same way.

## Which of the three carries a connection

The framework ships a ViewModel, a scenario and a shared store, and the hardest
question is not how any of them works but which one a connection belongs to. The
ladder, in order — take the first rung that fits and stop:

1. **One ViewModel owns the state.** Start here always. A screen with a question
   about its own data has no connection to carry.
2. **Another must REACT — a scenario.** It carries a fact (`GapCompleted`), not a
   command, and each side decides what the fact means for its own state. Nobody
   imports anybody: that is the whole reason the layer exists.
3. **Several must CO-EDIT one state — one shared store.** Only when scenarios have
   turned into synchronisation: the same value written in three ViewModels, kept in
   step by hand, racing on a slow answer. Keep the store scoped to the feature and
   give it explicit reset points.
4. **The store became a bus — the feature boundary is wrong.** A shared store that
   everything reads is global state with extra steps. Split the feature and hand
   cross-feature connections back to scenarios.

The rungs are not styles to pick between. Each costs more than the one above: a
scenario is a name in two files, a shared store is a lifetime somebody has to own.

`no-viewmodel-to-viewmodel` in `@lankajs/tool-eslint` enforces the only hard part —
that rung 1 never reaches sideways — and the core playground runs rungs 2 and 3
beside each other: a scenario writes into a ViewModel that never heard of the
trigger, and two ViewModels share one selection through `PlaygroundTodoStore`.

## Naming rule

**Anything the consumer writes in their own code carries the framework name.**
`ALankaGateway`, `ALankaScenario`, `createLankaVM`, `lankaEventBus`, `LankaLogger`,
`lankaSingletons`.

Two reasons, the second the stronger one. A reader of an unfamiliar file can see where
`ALankaGateway` came from; `AGateway` says nothing. And the framework does not squat
popular names — `Logger`, `EventBus`, `Storage`, `Singletons`, `Scenarios` are exactly
the names an app wants for ITS own things, and a library that takes them forces the app
to rename.

`ViewModel` shortens to `VM` in class, factory and type names: `ALankaVM` and
`createLankaVM` are written in every screen file — the same ViewModel reached from
either style, one of the nine roles `skills/parity/SKILL.md` governs.

Three names stay bare — `isRecord`, `getStringField`, `generateUuid`. They are pure
utilities over ordinary values; a collision there is resolved at the import site, which
is not available for a class that gets EXTENDED.

The rule is executed by `core/src/brand.test.ts`, not stated in a document.

`.lanka_di` barrel names (`Gateways.ts`, `Scenarios.ts`, …) are NOT branded: those files
belong to the consumer and the folder already says whose they are.

---

Repository map: [../README.md](../README.md)
