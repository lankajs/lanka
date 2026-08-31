---
name: lanka-testing
description: Test a lanka application — a fresh framework per test, rendering components that read a ViewModel, transport and scenario doubles, and the benchmark yardstick. Use when writing or fixing tests in a lanka project, when tests pass alone and fail together, when `@lanka_di` fails to resolve under vitest, or when adding a benchmark.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-testing
    version: "1.0.0"
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
	setup: (lanka) => lanka.locators.gateways.registerInstance("TodoGateway", fakeGateway),
});
```

A **fresh instance per call**, not per file. A test that inherits foreign
subscriptions goes red where nothing is broken.

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
```

`lankaTestHost` is the host for any test that is not about the host.

**There is no ViewModel double**, deliberately: the ViewModel is the subject, and
everything it needs from outside is a parameter.

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

## Symptom → cause

| What you see                             | What it is                                       |
| ---------------------------------------- | ------------------------------------------------ |
| tests pass alone, fail together          | a shared instance, or a missing `resetLanka()`   |
| "cannot resolve `@lanka_di/Scenarios`"   | `lankaDiAlias()` missing from the vitest config  |
| a spy on a mocked bus was called 0 times | a top-level import in a setup file               |
| a test receives another test's events    | the previous instance was replaced, not disposed |
| a bench reports `NaN`                    | no active framework, or a missing yardstick      |

## More

`reference.md` — the full guide, including every subpath and why they exist.
