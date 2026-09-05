<!-- Generated from tools/testing/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/tool-testing@1.1.0`** — this document describes that version.
>
> Install: `npm install @lankajs/tool-testing react vitest zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [tools/testing/_playground/playground.test.tsx](https://github.com/lankajs/lanka/blob/main/tools/testing/_playground/playground.test.tsx)

# @lankajs/tool-testing — user guide

The test kit: a fresh framework instance per test, a render helper, a host, the
doubles, two recorders, a way to wait for the work to finish, the vitest setup
file, and the benchmark yardstick.

## You will learn

- the two config lines every lanka project needs under vitest
- why every test gets a brand-new framework instance
- which doubles ship, and which one deliberately does not
- how to answer a different endpoint for each request your screen makes
- how to assert that a scenario fired, and that the framework logged
- how to wait for the wire without `await new Promise((r) => setTimeout(r, 0))`
- how a benchmark is measured so the number survives the machine

## When to reach for this

Install it in every project that has tests. Everything in it exists because the
alternative was twenty lines of preamble per file, diverging silently.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install -D @lankajs/tool-testing
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "@lankajs/tool-testing/vitest";

export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		alias: lankaDiAlias(),
	},
});
```

Both lines matter:

- **`setupTests`** gives every test a clean framework.
- **`lankaDiAlias()`** substitutes a `.lanka_di` fixture for your application's
  barrels. Not only for component tests: **anything importing `lanka` pulls in
  the scenario bootstrap, which reads `@lanka_di/Scenarios`.**

## Rendering a component

```tsx
import { renderWithLanka } from "@lankajs/tool-testing";

const { getByText, lanka } = renderWithLanka(<TodoScreen />, {
	fakes: { gateways: { TodoGateway: fakeGateway } },
});
```

A component reading a ViewModel needs a live instance — without one the first
scenario or locator access fails. Assembling bootstrap in every component test is
twenty lines of preamble that diverge between files silently: one test creates an
instance, another relies on the previous one, and file order starts deciding the
outcome.

**Every call gets a fresh instance**, not reused even within one file. A test
that inherits foreign subscriptions passes or fails depending on its neighbour —
the worst kind of unreliable test, because it goes red where nothing is broken.

Options: `host` (the test host by default), `fakes`, `setup`, and everything
`@testing-library/react`'s `render` takes except `wrapper`.

`fakes` is registered **before** `setup` runs, so a test may use both: the map is
the common case, and the callback is for what a map cannot say — installing a
plugin, registering a scenario.

## Standing a double in for a dependency

```ts
import { registerLankaFakes } from "@lankajs/tool-testing";

registerLankaFakes(lanka, {
	gateways: { TodoGateway: fakeGateway },
	singletons: { AnalyticsService: fakeAnalytics },
	sharedStores: { SessionSharedStore: fakeSession },
	scenarios: { TodoCompleted: fakeScenario },
});
```

The keys are the **class names** your `.lanka_di` barrels publish — the names the
locator resolves. Which locator holds what, and that the method is called
`registerInstance`, is mechanism you should not have to learn; this is the
sentence that says which double stands for which name.

Your doubles do **not** have to extend `ALankaGateway` or any other base. That
they do not is the whole reason they are cheap to write.

`renderWithLanka({ fakes })` is the same thing for a test that renders.

## Resetting without rendering

```ts
import { resetLanka } from "@lankajs/tool-testing";

beforeEach(() => {
	lanka = resetLanka();
});
```

A **new** instance rather than a cleaned one: cleaning leaves behind whatever
nobody remembered to clean, which is exactly the class of failure an instance
removes.

It also **disposes the previous instance** before releasing the pointer. That
matters more than it looks: ViewModels are declared at module level and outlive
any test, and their subscriptions are removed by the `dispose()` of the instance
whose registry holds them. Merely pointing at a new instance would leave the
previous test's subscriptions alive, and the next test would receive events the
first one subscribed to.

The setup file calls this for you; use it directly when a test needs the instance
in hand.

## The test host

```ts
import { lankaTestHost } from "@lankajs/tool-testing";
```

`https://api.test` and four plain English messages. Use it whenever the host is
not what your test is about — and when it _is_, build your own stub and assert
what was asked of it.

## Test doubles

### A transport

```ts
import { createLankaFakeTransport } from "@lankajs/tool-testing";

const transport = createLankaFakeTransport({ body: [{ id: 1 }], status: 200 });
const gateway = new TodoGateway(transport);

await gateway.list();
expect(transport.calls[0].endpoint).toBe("https://api.test/todos");
```

| Option     | Meaning                                     |
| ---------- | ------------------------------------------- |
| `body`     | the successful response body (default `{}`) |
| `status`   | the status (default 200)                    |
| `failWith` | throw this instead of answering             |
| `routes`   | a different answer per endpoint — below     |

`calls` records every request with its options; `callsTo(match)` filters them the
same way a route matches.

#### One answer per endpoint

A screen reads more than one endpoint, and a double that answers all of them the
same way cannot test it:

```ts
const transport = createLankaFakeTransport({
	routes: [
		{ match: "/todos", body: [{ id: 1 }] },
		{ match: /\/users\/\d+$/, body: { id: 7, name: "Ada" } },
		{ match: (endpoint, options) => options?.method === "POST", status: 201 },
	],
	body: {}, // anything no route matched
});
```

The first matching route answers; nothing matching falls through to the
top-level `body` / `status` / `failWith`. A route matches by substring, by
pattern, or by a predicate that also sees the request options.

| Route option              | Meaning                                            |
| ------------------------- | -------------------------------------------------- |
| `match`                   | substring, `RegExp`, or `(endpoint, options)`      |
| `body`, `status`          | the successful answer                              |
| `failWith`                | throw instead                                      |
| `times`                   | answer this way at most N times, then fall through |
| `delayMs`                 | answer only after this long                        |

`times` is how "failed once, then succeeded" is written — the shape a retry
policy is tested with:

```ts
const transport = createLankaFakeTransport({
	routes: [{ match: "/todos", times: 1, failWith: () => new TypeError("Failed to fetch") }],
	body: [{ id: 1 }],
});
```

`delayMs` is how a loading state is asserted: without it the request has already
finished by the time your assertion runs. It uses a real timer, so a test that
opts into `vi.useFakeTimers()` advances the clock itself.

### A scenario

```ts
import { createLankaFakeScenario } from "@lankajs/tool-testing";

const completed = createLankaFakeScenario<{ id: number }>();
completed.emit({ id: 1 });
expect(completed.subscriberCount()).toBe(1);
expect(completed.emitted).toEqual([{ id: 1 }]);
```

It returns a **real** unsubscribe function rather than a stub — otherwise a test
checking that a ViewModel unsubscribes would only prove it called a function that
does nothing. `emitted` is every payload it carried, so a test asserting **what**
a ViewModel published does not have to wrap `emit` and then assert on its own
wrapper.

### What is deliberately not here

**A ViewModel double.** There is nothing to substitute: the ViewModel is the
subject under test, and everything it needs from outside — gateways and services
— is passed as parameters.

**A storage double.** This package depends on `lanka` and nothing else. A double
over `@lankajs/storage`'s port would make a tool depend on a module, which is the
opposite of the direction everything else here points; it belongs beside that
module.

## Asserting what the application did

### A scenario fired

```ts
import { createLankaEventRecorder } from "@lankajs/tool-testing";

const events = createLankaEventRecorder({ lanka });

await todoVM.getState().complete(1);

expect(events.of<{ id: number }>("todo.completed")).toEqual([{ id: 1 }]);
expect(events.count("todo.completed")).toBe(1);
events.stop();
```

The scenario layer is what a lanka application is arranged around, and this is
the question it exists to answer: **did doing this make that fire.** Without the
recorder the answer is a bus middleware you wrote and a closure you then assert
on.

`waitFor` is the same question when the fact arrives later:

```ts
const profile = await events.waitFor<IProfile>("profile.loaded", { timeoutMs: 500 });
```

It **rejects** on its deadline, naming the event — resolving late and silently is
how a suite acquires tests that pass without the thing having happened. An event
that has already crossed resolves immediately, so waiting for something that
happened a microtask ago is not a hang.

`{ lanka }` is optional: without it the recorder watches the **active** instance,
which is what the setup file created. `stop()` removes the middleware; a recorder
left running inside one file counts its neighbour's events.

### The framework logged

```ts
import { createLankaLogRecorder } from "@lankajs/tool-testing";

const log = createLankaLogRecorder({ console: "silence" });

await todoVM.getState().load();

expect(log.contains("GET /todos")).toBe(true);
expect(log.of("error")).toHaveLength(0);
log.stop();
```

Spying on `console.log` pins how the logger **formats** — badges, colours, the
argument order — onto a test that meant to assert a decision.

The recorder **turns the log on**, and that is deliberate: logging is off under
test, so a recorder that only added a sink would answer an empty array and your
test would pass having proved nothing. `stop()` puts every flag back.
`console: "silence"` keeps the run quiet and restores the console afterwards.

## Waiting for the work to finish

```ts
import { waitForLankaIdle } from "@lankajs/tool-testing";

void todoVM.getState().load();
await waitForLankaIdle({ lanka });

expect(screen.getByText("Buy milk")).toBeTruthy();
```

The line this replaces is `await new Promise((r) => setTimeout(r, 0))`, and it is
not a wait but a guess: it drains **one** turn, so it works until the chain
behind the request grows a link — and then a test nobody touched goes red.

`waitForLankaIdle` returns when nothing is on the wire **and** the work the
request started has settled. It rejects on its deadline naming how many requests
are still outstanding, because "timed out" with no subject sends you to the wrong
half of the application.

| Option         | Meaning                                            |
| -------------- | -------------------------------------------------- |
| `lanka`        | whose wire to watch; the active instance otherwise |
| `timeoutMs`    | how long before failing (default 1000)             |
| `settleTurns`  | task turns to drain once the wire is clear (2)     |

It drains **real** task turns, so a test that opts into `vi.useFakeTimers()`
advances the clock itself.

## Benchmarks

```ts
import {
	lankaBenchCalibration,
	LANKA_BENCH_OPTIONS,
} from "@lankajs/tool-testing/lankaBenchCalibration";

describe("createLankaTrackedHook", () => {
	lankaBenchCalibration();

	bench(
		"reads a tracked key",
		() => {
			/* … */
		},
		LANKA_BENCH_OPTIONS,
	);
});
```

**Register it first in every bench file.** `27,212,092 ops/sec` is a fact about
one machine on one afternoon: a laptop on battery answers half of it, and CI
answers something else again. A ratio between two operations measured in the same
process survives all of that — the machine, the thermal state, the noise of a
parallel run scale both numbers together.

So every recorded number is "how many of these one call costs".

**In every file, not once per package**, because vitest gives each bench file its
own worker, and a yardstick measured in another process is a yardstick measured
on another machine. It costs 0.25 s per file — a fifth of what starting that
worker already cost.

## Subpaths

| Import                                      | Gives                 |
| ------------------------------------------- | --------------------- |
| `@lankajs/tool-testing`                       | the kit               |
| `@lankajs/tool-testing/setupTests`            | the vitest setup file |
| `@lankajs/tool-testing/vitest`                | `lankaDiAlias()`      |
| `@lankajs/tool-testing/lankaTestHost`         | the host alone        |
| `@lankajs/tool-testing/resetLanka`            | the reset alone       |
| `@lankajs/tool-testing/lankaBenchCalibration` | the yardstick         |

The narrow subpaths exist so a config file can import one thing without pulling
in React.

## Common mistakes

**Forgetting `lankaDiAlias()` in a non-component package.** The failure is a
module-resolution error from a barrel you never wrote.

**Reusing one instance across tests for speed.** The saving is milliseconds; the
cost is a suite whose result depends on file order.

**Mocking `lanka/scenario` and finding your spy was called zero times.** The
setup file resolves the registry lazily _inside_ the hook for exactly this
reason — anything a setup file imports at top level is evaluated before your
hoisted `vi.mock` runs. Keep your own setup files lazy the same way.

**Asserting a stubbed unsubscribe.** Use `createLankaFakeScenario`, whose
unsubscribe is real.

**Leaving a recorder running.** `createLankaEventRecorder` and
`createLankaLogRecorder` both return `stop()`. Between files the instance is
disposed for you; **within** one file a recorder that outlives its test counts
its neighbour's events, and a log recorder that outlives its test leaves the log
switched on.

**Draining one turn and calling it a wait.** `await new Promise((r) => setTimeout(r, 0))`
works until the chain behind your request grows a link. Use `waitForLankaIdle`.

**Using `vi.useFakeTimers()` with `delayMs` or `waitForLankaIdle`.** Both drain
real timers. Under fake ones the test advances the clock itself.

## Recap

- `setupFiles` **and** `lankaDiAlias()` — the alias is needed even without components.
- A fresh instance per call, and the previous one is disposed, not dropped.
- `routes` gives each endpoint its own answer; `times` and `delayMs` give it a
  history and a duration.
- `registerLankaFakes` says which double stands for which name; the locator is
  mechanism you should not have to learn.
- `createLankaEventRecorder` answers "did doing this make that fire";
  `createLankaLogRecorder` asserts the decision instead of the formatting.
- `waitForLankaIdle` waits for the wire; both it and `waitFor` REJECT rather than
  give up quietly.
- The scenario double returns a real unsubscribe; a stub would prove nothing.
- There is no ViewModel double, because the ViewModel is the subject.
- Benchmarks are measured in yardsticks, registered per file.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/tools/testing/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/tools/testing/README.md) · Testing canon:
[../../skills/testing/SKILL.md](https://github.com/lankajs/lanka/blob/main/skills/testing/SKILL.md)
