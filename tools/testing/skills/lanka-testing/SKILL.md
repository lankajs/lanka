---
name: lanka-testing
description: Test a lanka application — a fresh framework per test, rendering components that read a ViewModel, transport and scenario doubles with a route per endpoint, recorders for the bus and the log, and waiting for the wire to clear. Use when writing or fixing tests in a lanka project, when a screen reads more than one endpoint, when asserting that a scenario fired or that the framework logged, when a test needs to wait for a request, when tests pass alone and fail together, when `@lanka_di` fails to resolve under vitest, or when adding a benchmark.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-testing
    version: "1.0.1"
---

# @lankajs/tool-testing

The test kit. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## vitest config — both lines matter

```ts
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		alias: lankaDiAlias(),
	},
});
```

`setupTests` gives every test a clean framework. `lankaDiAlias()` substitutes a
`.lanka_di` fixture — needed **not only** for component tests: anything importing
`lanka` pulls in the scenario bootstrap, which reads `@lanka_di/Scenarios`.

## Rendering

```ts
const { getByText, lanka } = renderWithLanka(<TodoScreen />, {
	fakes: { gateways: { TodoGateway: fakeGateway } },
});
```

A **fresh instance per call**, not per file. A test that inherits foreign
subscriptions goes red where nothing is broken.

`fakes` keys are the CLASS NAMES your `.lanka_di` barrels publish, across
`gateways`, `singletons`, `sharedStores` and `scenarios`. They are registered
before `setup` runs, so a test may use both. `registerLankaFakes(lanka, fakes)`
is the same thing without a component.

Your doubles do **not** have to extend any base — that they do not is what makes
them cheap.

## Resetting without rendering

```ts
beforeEach(() => {
	lanka = resetLanka();
});
```

A **new** instance, and the previous one is **disposed** first. ViewModels are
declared at module level and outlive any test; their subscriptions are removed by
the `dispose()` of the instance whose registry holds them.

## Doubles

```ts
const transport = createLankaFakeTransport({ body: [{ id: 1 }], status: 200 });
// or: { failWith: () => new Error("network") }
expect(transport.calls[0].endpoint).toBe("https://api.test/todos");

const completed = createLankaFakeScenario<{ id: number }>();
completed.emit({ id: 1 });
expect(completed.subscriberCount()).toBe(0); // its unsubscribe is REAL
expect(completed.emitted).toEqual([{ id: 1 }]); // and it remembers what it carried
```

**A screen reads more than one endpoint.** One answer for all of them is why
people write the twenty-line double this kit exists to prevent:

```ts
const transport = createLankaFakeTransport({
	routes: [
		{ match: "/todos", body: [{ id: 1 }] },
		{ match: //users/d+$/, body: { id: 7 } },
		{ match: "/todos", times: 1, failWith: () => new TypeError("Failed to fetch") },
		{ match: (endpoint, options) => options?.method === "POST", status: 201, delayMs: 20 },
	],
	body: {}, // anything no route matched
});
expect(transport.callsTo("/todos")).toHaveLength(2);
```

First match wins; `times` exhausts a route so the next one answers — that is how
"failed once, then succeeded" is written. `delayMs` is how a loading state is
asserted. Both use REAL timers.

`lankaTestHost` is the host for any test that is not about the host.

**There is no ViewModel double**, deliberately: the ViewModel is the subject, and
everything it needs from outside is a parameter.

## Asserting what the application DID

```ts
const events = createLankaEventRecorder({ lanka }); // omit lanka: the active instance
await todoVM.getState().complete(1);
expect(events.of<{ id: number }>("todo.completed")).toEqual([{ id: 1 }]);
const profile = await events.waitFor<IProfile>("profile.loaded", { timeoutMs: 500 });
events.stop();

const log = createLankaLogRecorder({ console: "silence" });
expect(log.contains("GET /todos")).toBe(true);
expect(log.of("error")).toHaveLength(0);
log.stop();
```

The recorder answers the question the scenario layer exists for: **did doing this
make that fire.** The log recorder asserts the DECISION rather than the
formatting — a `console.log` spy pins badges, colours and argument order onto a
test that meant none of them.

The log recorder turns logging on (it is off under test) and `stop()` puts every
flag back. Call `stop()` on both: within one file a recorder that outlives its
test counts its neighbour's events.

## Waiting

```ts
void todoVM.getState().load();
await waitForLankaIdle({ lanka, timeoutMs: 1000 });
expect(screen.getByText("Buy milk")).toBeTruthy();
```

It returns when nothing is on the wire **and** the work the request started has
settled, and it REJECTS on its deadline naming how many requests are outstanding.
It replaces `await new Promise((r) => setTimeout(r, 0))`, which is not a wait but
a guess: it drains one turn, so it works until the chain grows a link.

## Benchmarks

```ts
describe("myOperation", () => {
	lankaBenchCalibration(); // FIRST, in every bench file
	bench("does the thing", () => { … }, LANKA_BENCH_OPTIONS);
});
```

Numbers are **yardsticks**, not hertz: a ratio between two operations measured in
the same process survives the machine, the thermal state and a parallel run. In
every file, because vitest gives each bench file its own worker.

## Never do these

- **Never reuse one instance across tests** for speed. The saving is
  milliseconds; the cost is a suite whose result depends on file order.
- **Never import anything at the top of your own setup file.** A setup file runs
  before the test's hoisted `vi.mock`, so a top-level import binds the real
  module and the mock never reaches it — the failure looks like "the spy was
  called 0 times".
- **Never stub an unsubscribe.** Use `createLankaFakeScenario`.
- **Never omit `lankaDiAlias()`** because "this package has no components".
- **Never write your own `setTimeout(0)` wait.** Use `waitForLankaIdle`.
- **Never leave a recorder running** inside a file. Call `stop()`.
- **Never combine `vi.useFakeTimers()` with `delayMs` or `waitForLankaIdle`**
  without advancing the clock yourself: both drain real timers.

## Symptom → cause

| What you see                             | What it is                                       |
| ---------------------------------------- | ------------------------------------------------ |
| tests pass alone, fail together          | a shared instance, or a missing `resetLanka()`   |
| "cannot resolve `@lanka_di/Scenarios`"   | `lankaDiAlias()` missing from the vitest config  |
| a spy on a mocked bus was called 0 times | a top-level import in a setup file               |
| a test receives another test's events    | the previous instance was replaced, not disposed |
| a bench reports `NaN`                    | no active framework, or a missing yardstick      |
| every endpoint answers the same body     | one answer instead of `routes`                   |
| a log recorder's `lines` is empty        | you stopped it, or a previous test left it stopped |
| an assertion runs before the data arrives | a hand-rolled one-turn wait; use `waitForLankaIdle` |
| a test sees a neighbour's events         | a recorder in the same file was never stopped    |

## More

`reference.md` — the full guide, including every subpath and why they exist.
