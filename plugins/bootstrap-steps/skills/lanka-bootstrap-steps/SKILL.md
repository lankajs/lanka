---
name: lanka-bootstrap-steps
description: Build a start-up chain for a lanka application — steps that pass a context along, stop early and say where to send the user. Use when start-up has ordered stages, when a step must redirect to sign-in, when a start-up task must not abort the rest, or when reviewing code that imports `@lankajs/plugin-bootstrap-steps`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/plugin-bootstrap-steps
    version: "1.0.0"
---

# @lankajs/plugin-bootstrap-steps

A start-up **chain**. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it? Core already has bootstrap services

|                      | core `bootstrap({ services })` | this pipeline            |
| -------------------- | ------------------------------ | ------------------------ |
| shape                | a set, run by priority         | a chain, in order        |
| passing values along | no                             | yes, through the context |
| stopping early       | no                             | `done: true`             |
| saying where to go   | no                             | `redirectTo`             |

Core can only "run or throw", and "the user is not signed in" is a **decision**,
not a failure. That is the whole reason this exists.

## Use

```ts
interface IStartupContext {
	done?: boolean;
	redirectTo?: string | null;
	session: ISession | null;
}

const startup = lankaBootstrapSteps<IStartupContext>({
	createContext: () => ({ session: null }), // a FUNCTION, so a repeat run starts clean
	report: (message) => lankaLogger.printBootstrapLog(message),
	steps: [
		{
			name: "restore-session",
			run: async (ctx) => ({ ...ctx, session: await session.restore() }),
			timeoutMs: 4000,
		},
		{
			name: "require-sign-in",
			run: (ctx) => (ctx.session ? ctx : { ...ctx, done: true, redirectTo: "/sign-in" }),
		},
		{
			name: "analytics",
			run: async (ctx) => {
				await analytics.identify(ctx.session);
				return ctx;
			},
			optional: true,
		},
	],
});

lanka.use(startup);
const result = await startup.pipeline.run();
if (result.redirectTo) router.navigate(result.redirectTo);
```

A step **returns** the context it changed; return `ctx` unchanged when it has
nothing to add.

## `optional` and `timeoutMs`

The same two words core's services use, with the same meaning — the executor
differs, the questions do not.

- `optional: true` — a failure does not abort the pipeline, and the context
  continues **untouched**: a step that failed midway may have written half its
  result, and half is worse than nothing.
- `timeoutMs` — a deadline. Without one, a step that never settles means the app
  never paints.

## Steps as classes

For a step that carries something of its own — a gateway, a counter, a value the
previous run left:

```ts
class RestoreSessionStep extends ALankaBootstrapStep<IStartupContext> {
	public readonly name = "restore-session";
	protected override readonly timeoutMs = 4000;
	protected async run(ctx) {
		return { ...ctx, session: await this.gateway.restore() };
	}
}

steps: [new RestoreSessionStep(gateway).toConfig()];
```

## Never do these

- **Never throw to stop the pipeline.** A throw is a failure; `{ done: true }` is
  a decision, and only it carries a `redirectTo`.
- **Never mutate the context.** A failed optional step must leave nothing behind,
  and that only works if steps return rather than write.
- **Never give a network step no deadline.**
- **Never expect a completed run to repeat.** Only an early exit re-runs — which
  is what lets a user sign in and continue.

## Symptom → cause

| What you see                            | What it is                                      |
| --------------------------------------- | ----------------------------------------------- |
| the app is stuck on a blank screen      | a step with no `timeoutMs` that never settles   |
| sign-in fails and takes the app with it | a required step that should be `optional`       |
| stranded on the sign-in screen forever  | an early exit being remembered — it must not be |
| a field set by a step that failed       | the context was mutated instead of returned     |

## More

`reference.md` — the full guide, including `reset()` and the plugin's lifetime.
