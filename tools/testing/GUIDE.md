# @lankajs/tool-testing — user guide

The test kit: a fresh framework instance per test, a render helper, a host, two
test doubles, the vitest setup file, and the benchmark yardstick.

## You will learn

- the two config lines every lanka project needs under vitest
- why every test gets a brand-new framework instance
- which doubles ship, and which one deliberately does not
- how a benchmark is measured so the number survives the machine

## When to reach for this

Install it in every project that has tests. Everything in it exists because the
alternative was twenty lines of preamble per file, diverging silently.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
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
	setup: (lanka) => {
		lanka.locators.gateways.registerInstance("TodoGateway", fakeGateway);
	},
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

Options: `host` (the test host by default), `setup`, and everything
`@testing-library/react`'s `render` takes except `wrapper`.

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

`calls` records every request with its options.

### A scenario

```ts
import { createLankaFakeScenario } from "@lankajs/tool-testing";

const completed = createLankaFakeScenario<{ id: number }>();
completed.emit({ id: 1 });
expect(completed.subscriberCount()).toBe(1);
```

It returns a **real** unsubscribe function rather than a stub — otherwise a test
checking that a ViewModel unsubscribes would only prove it called a function that
does nothing.

### What is deliberately not here

**A ViewModel double.** There is nothing to substitute: the ViewModel is the
subject under test, and everything it needs from outside — gateways and services
— is passed as parameters.

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

## Recap

- `setupFiles` **and** `lankaDiAlias()` — the alias is needed even without components.
- A fresh instance per call, and the previous one is disposed, not dropped.
- The scenario double returns a real unsubscribe; a stub would prove nothing.
- There is no ViewModel double, because the ViewModel is the subject.
- Benchmarks are measured in yardsticks, registered per file.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Testing canon:
[../../skills/testing/SKILL.md](../../skills/testing/SKILL.md)
