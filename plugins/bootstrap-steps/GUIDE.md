# @lankajs/plugin-bootstrap-steps — user guide

A start-up **chain**: each step reads what the previous one produced, and any
step may say "stop here, and send the user there".

## You will learn

- when a start-up chain beats core's set of services
- how a step stops the chain and says where to send the user
- what `optional` and `timeoutMs` protect against

## When to reach for this

Reach for it when start-up stages pass values along and one of them can decide
the rest is pointless — restore a session, then redirect to sign-in. Tasks that
do not talk to each other are core's `services`.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/plugin-bootstrap-steps
```

`lanka` is a peer dependency.

## Do I need it? Core already has bootstrap services

Those are a **set**; this is a **chain**. Use core's `services` when the tasks do
not talk to each other, and this when they do.

|                      | core `bootstrap({ services })` | this pipeline            |
| -------------------- | ------------------------------ | ------------------------ |
| Shape                | a set, run by priority         | a chain, in order        |
| Passing values along | no                             | yes, through the context |
| Stopping early       | no                             | `done: true`             |
| Saying where to go   | no                             | `redirectTo`             |

Core can only "run or throw", and an early exit cannot be expressed that way: an
exception means failure, and "the user is not signed in" is a **decision**.

## Quick start

```ts
import { lankaBootstrapSteps } from "@lankajs/plugin-bootstrap-steps";

interface IStartupContext {
	done?: boolean;
	redirectTo?: string | null;
	session: ISession | null;
}

const startup = lankaBootstrapSteps<IStartupContext>({
	createContext: () => ({ session: null }),
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

## The context

`createContext` is a **function, not a value**, so a repeat run starts clean.

Your context extends `ILankaBootstrapOutcome`:

```ts
{ done?: boolean; redirectTo?: string | null }
```

`done` is set by a **step** — it is the only way to say "the decision is made,
the rest is pointless". `redirectTo` is meaningful only together with it.

A step returns the context it changed. Return `ctx` unchanged when it has nothing
to add.

## `optional` and `timeoutMs`

The same two words core's bootstrap services use, with the same meaning, on
purpose: the executor differs, the questions the configuration answers do not.
Different words for one thing would force you to remember which of the two you
are in.

- **`optional: true`** — a failure does not abort the pipeline. Analytics failing
  at start-up must not take sign-in down with it. The context continues
  **untouched**: a step that failed midway may have written half its result, and
  continuing with that half is worse than continuing without it.
- **`timeoutMs`** — a deadline. Without one, a step that never settles holds
  bootstrap forever and the app never paints its first screen. Failing is more
  honest than waiting.

## Steps as classes

When a step carries something of its own — a gateway it was given, a counter of
attempts, a value the previous run left behind:

```ts
import { ALankaBootstrapStep } from "@lankajs/plugin-bootstrap-steps";

class RestoreSessionStep extends ALankaBootstrapStep<IStartupContext> {
    public readonly name = "restore-session";
    protected override readonly timeoutMs = 4000;

    private readonly gateway: SessionGateway;
    constructor(gateway: SessionGateway) { super(); this.gateway = gateway; }

    protected async run(ctx: IStartupContext): Promise<IStartupContext> {
        return { ...ctx, session: await this.gateway.restore() };
    }
}

steps: [new RestoreSessionStep(gateway).toConfig(), …];
```

`toConfig()` is the one place the two styles meet — the pipeline cannot tell
which wrote a step.

## Running it

```ts
await startup.pipeline.run(); // concurrent calls share one run
startup.pipeline.reset(); // forget the memory
```

**Only a completed run is remembered.** An early exit means "the user is not
signed in"; remembering it would strand the app on the sign-in screen forever.
After they sign in, `run()` starts again.

Removing the plugin or disposing the instance resets the pipeline — otherwise the
next instance (a test beside the app, a dev module reload) would consider
bootstrap done.

## Common mistakes

**Throwing to stop the pipeline.** A throw is a failure; `{ done: true }` is a
decision. Only the second carries a `redirectTo`.

**Mutating the context instead of returning a new one.** A failed optional step
must leave nothing behind, and that only works if steps return rather than write.

**A step with no deadline that talks to the network.** One unlucky request and
the app never paints.

**Expecting `run()` to re-run after an early exit.** It does — that is the
feature. What it does _not_ do is repeat a completed run.

## Recap

- A **chain**, not a set: each step reads what the previous produced.
- An early exit is a value (`done: true`), not an exception — only a value can carry a destination.
- A failed optional step returns the context untouched; half a result is worse than none.
- Only a completed run is remembered, so a user who signs in can continue.
- `createContext` is a function, so a repeat run starts clean.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Core's bootstrap:
[../../core/GUIDE.md](../../core/GUIDE.md)
