# Maintaining `lanka`

The core package: bootstrap, config, role, locator, gateway, validation, mock,
errors, scenario, viewmodel, logger. It is what every other package in this
repository is built on and what every consumer imports first, so almost
everything in it is a promise.

Read this before changing anything under `core/src/`. The repository-wide rules
it defers to are in [`../skills/`](../skills); this file carries only what is
true of core and of nothing else.

## Boundary

1. **Core knows nothing of modules and plugins.** No import from `modules/` or
   `plugins/`, ever. What two plugins need in common belongs here, behind an
   extension point — not in one of them.
2. **The only inward direction is `@lanka_di/*`**, the barrels a consuming
   application publishes to the framework. Core never imports from an
   application in any other way.
3. **A new extension point is the expensive decision in this package.** It is a
   public contract for the lifetime of a major version. The test question is
   "does core need a hook for this to work?" — if no, it is a module, and making
   it a plugin costs more forever.

## Layout

Flat by subsystem, no intermediate layer folders, because that buys one property:
**folder = subpath in `exports` = line in the README map.** Three lists that used
to be reconciled by hand became one.

- A subsystem is exported through its barrel (`index.ts`). Public is exactly what
  the barrel lists, so moving a file inside a subsystem is not a breaking change.
- `_extend/` is published as `lanka/extend`, `_internal/` as `lanka/internal`.
  Everything else under `src/` is a subsystem or is unreachable.
- Within a subsystem the bucket taxonomy of
  [`../skills/structure/SKILL.md`](../skills/structure/SKILL.md) applies:
  `_abstractions/`, `_factories/`, `_facades/`, `_utils/`, `_interfaces/`,
  `_types/`, `_guards/`, `_registries/`. The root of a subsystem holds domain
  implementations only.

`src/publicSurface.test.ts` enforces the map three ways: it is exactly what is
expected (an extra key is a promise made by accident), every key leads to an
existing barrel, and every subsystem in the tree is in the map. The last one
catches the failure that is otherwise invisible — a new subsystem added as a
folder and silently unreachable, noticed by the first consumer as a missing
feature.

## Invariants

Each of these exists because of something that went wrong. Do not relax one
without reading why it is here.

1. **All framework state lives on the instance.** Module-level state made three
   things impossible, none of which looked like a bug: two apps in one process
   shared a bus, SSR reused state between users' requests, and test isolation
   rested on a global `beforeEach` reaching into internal registries.

    The one deliberate exception is `ALankaScenario`'s static pool of constructed
    scenarios. That is a registry of _definitions_, not runtime state — the
    classes come from one `@lanka_di/Scenarios` barrel and both instances must see
    the same list. Splitting it would be divergence, not isolation.

2. **Ambient facades resolve the one active instance** through
   `_internal/activeRuntime.ts`, and they exist only for callers that cannot hold
   an instance: a user-extended `ALankaScenario`, the scenario bootstrap, a
   module package with no instance in scope. Isolation belongs to the instance
   holder; a facade cannot offer it, so never add one as a convenience.

    **Which instance is active is a STRATEGY, not a pointer.**
    `setLankaRuntimeResolver` replaces the answer wholesale — the module pointer
    is not consulted behind an installed resolver. That is what lets a server
    package answer per request (`@lankajs/host`) while a browser keeps one instance
    per document. Two things must stay true: core ships no resolver and names no
    package that might install one, and the resolver's `null` is a named failure
    rather than a fall-back, because falling back means one request reading
    another request's framework.

    The strategy is read inline in `requireActiveRuntime`, not through
    `getActiveRuntime()`. This is the hottest path in the framework, and a call
    that only forwards shows up in `perf/`.

3. **Every public name carries the framework's name.** `ALankaGateway`, not
   `AGateway`; `lankaStorage`, not `storage`. Pinned by `src/brand.test.ts`. Two
   reasons, the second stronger: a reader of an unfamiliar file can see where a
   name came from, and the framework does not squat the names an application
   wants for its own things. That was not hypothetical — a class `Storage`
   collided with the browser global, and inside its own adapter the type
   `Storage` meant both.

4. **Every role ships both styles over one implementation.** `ILankaX` +
   `ALankaX` + `createLankaX`, where the factory builds the _same_ class as a
   bridge subclass and hands its protected surface to the caller. The protected
   names must equal the context field names. Enforced by `check:parity`; the
   reasoning is [`../skills/parity/SKILL.md`](../skills/parity/SKILL.md).

5. **A failure kind is assigned where the failure is born** — in
   `ALankaRequest.execute`, the single point every request passes through. Six
   kinds rather than one, because each demands something different of the
   interface. Do not add a seventh without a screen that would render it
   differently.

6. **A check that cannot fail reports success.** The async-schema rejection, the
   locator's named refusal, the blind-spot warning: each is loud on purpose. If
   you find yourself making one of them quieter, you are removing the reason it
   was written.

7. **A lazy ViewModel promises exactly what its eager twin promises, plus
   `dispose`.** One mechanism —
   `viewmodel/_internal/create-lazy-lanka-hook/createLazyLankaHook.ts` — carries
   build-on-first-access, member forwarding and release for all three variants,
   and each factory contributes the one line that says WHAT gets built. It was
   three copies, and the copies had drifted: three different member lists and two
   public types missing `dispose`.

    Forwarding is a `Proxy`, not a list, and it wraps every member so a READ
    builds nothing. Both halves are load-bearing: a list has to be kept in step
    with a store somebody else releases, and an eager trap would end laziness at
    the first devtool that looks at the object.

8. **`_factories/` holds what the package exports; the machinery is
   `_internal/`.** Both are `create…`, so the bucket alone cannot tell the seven
   calls an application makes from the four pieces they are built from —
   `check-structure` reports `[factory-not-published]` when a factory in
   `_factories/` is absent from the surface. Canon: `skills/structure/SKILL.md`
   §5a-ii.

## Adding a published name

In this order, before the code is written:

1. **Tier.** `facade` (until a major, never removed), `extend` (may move in a
   minor), `internal` (any release). Written in the import path so a reader sees
   it. [`../skills/surface/SKILL.md`](../skills/surface/SKILL.md).
2. **Form.** Class, factory, frozen table, function, ambient instance — and why
   the other four are wrong. [`../skills/forms/SKILL.md`](../skills/forms/SKILL.md).
3. **Parity**, if it is a role: all three names, one implementation.
4. **A playground scene.** `core/_playground/` drives both styles of everything
   through the same steps and asserts the same results; `check:api` refuses a new
   facade name without one, and a unit test does not satisfy that rule, because a
   scene shows how a consumer _uses_ the thing.
5. **The report.** `node scripts/check-api.mjs --write`, then read the diff. That
   reading is the review of what core now promises.
6. **`GUIDE.md`**, if a consumer would ever type the name. A published name
   nobody documented is a promise kept and never collected.

Removing a facade name is a major version and a decision, not a cleanup. A
superseded name keeps working with an `@deprecated` tag carrying its four facts —
the version the replacement shipped in, the replacement's name, and one clause of
why.

## Tests

- Beside the unit, in the unit's own folder. The playground is the integration
  layer and lives in `core/_playground/`.
- **Two vitest projects**, `node` and `dom`. Building a jsdom per file is the
  suite's most expensive line item, so the `.ts` tests that genuinely need a DOM
  are listed explicitly in `vitest.domTests.ts`. Add to that list rather than
  moving a test to `.tsx`.
- **Benches are named explicitly per project.** The default glob hands one bench
  file to both projects, measures it twice and records whichever finished last.
- Coverage thresholds are a **ratchet**: statements 94, branches 92, functions
  92, lines 94, measured twice at 95.88 / 93.33 / 93.87 / 95.88. They rise when
  you measure a higher floor — in the same commit as the tests that raised it —
  and they are never lowered to make a run pass. Each sits about a point below
  the measurement deliberately: two runs of an unchanged suite differ in the
  hundredths, so a threshold nailed to the best observation fails on a coin toss.
- `@lanka_di` resolves to the test kit's fixture under test. Core is not its only
  user: anything importing `lanka` pulls in the scenario bootstrap, which reads
  `@lanka_di/Scenarios`.

## Performance

Five benches live in core, beside what they measure:
`ALankaGateway.bench.ts`, `createLankaLocatorProxy.bench.ts`,
`LankaEventBusInstance.bench.ts`, `createLankaBlindSpotTrap.bench.ts`,
`createLankaVM.bench.ts`.

Numbers are in yardsticks — `lankaBenchCalibration()` calls — never hertz. Before
believing any change, run the three-run A/B protocol in
[`../skills/performance/SKILL.md`](../skills/performance/SKILL.md). The recorded
baseline is `perf/lanka.perf.md` and it is written by
`node scripts/check-perf.mjs --write`, never by hand.

## Before you finish

```bash
pnpm --filter lanka test
pnpm --filter lanka test:coverage
node scripts/check-api.mjs
node scripts/check-parity.mjs
node scripts/check-forms.mjs
pnpm check
```

## Traps

**A new subsystem folder without a map entry** compiles, lints and passes every
test except `publicSurface`. Add the `exports` key, the README line and the
subsystem list together.

**Widening a protected member to public** to make a factory work. The factory is
a subclass and can already reach it; a public surface here is a promise you did
not mean to make.

**Putting a config-merge rule in the config module.** It lives on the instance
deliberately: importing it from `config/` pulls that module into every test's
graph through the test kit, and any test partially mocking the config module then
fails the whole suite with "No export is defined on the mock".

**Adding a `next()`-style hook.** Request middleware is a wrapper because retry
needs to re-run the request; the event bus middleware returns a _decision_
because a skipped `next()` would make an event vanish silently. Both shapes are
deliberate and they are deliberately different.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · Why it is shaped this way:
[README.md](./README.md) · Repository router: [../AGENTS.md](../AGENTS.md)
