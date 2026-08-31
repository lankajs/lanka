# lanka — user guide

The core package. Everything in this guide works with `lanka` alone; modules and
plugins are optional and have guides of their own.

If you want to know _why_ the framework is shaped this way, read
[README.md](./README.md). This file is about _using_ it.

## You will learn

- how to start the framework in one line, and what that line does
- the four layers, and the one direction imports go
- how a screen gets data: gateway → ViewModel → view
- how two screens reach each other without importing each other
- what fails loudly on purpose, and why

> [!NOTE]
> This guide shows how lanka is _meant_ to be used. Very little of it is
> required: [ARCHITECTURE.md](../ARCHITECTURE.md) separates the five things the
> machine checks from the many that are advice you can take or leave.

## Contents

- [Install](#install)
- [Your first application](#your-first-application)
- [The layers, and which way imports go](#the-layers-and-which-way-imports-go)
- [The instance](#the-instance)
- [The host contract](#the-host-contract)
- [Flags](#flags)
- [Gateways — talking to a server](#gateways--talking-to-a-server)
- [Failure](#failure)
- [Validating a response](#validating-a-response)
- [ViewModels](#viewmodels)
- [Choosing a coordination tool](#choosing-a-coordination-tool)
- [Shared stores](#shared-stores)
- [Stateless ViewModels](#stateless-viewmodels)
- [Lazy ViewModels](#lazy-viewmodels)
- [Scenarios — cross-screen facts](#scenarios--cross-screen-facts)
- [The locator](#the-locator)
- [Scopes](#scopes)
- [Mock mode](#mock-mode)
- [The logger](#the-logger)
- [Plugins](#plugins)
- [Roles — both styles for your own layer](#roles--both-styles-for-your-own-layer)
- [Import map](#import-map)
- [What else ships](#what-else-ships)
- [Cases](#cases)
- [Common mistakes](#common-mistakes)
- [Recap](#recap)

## Install

```bash
npm  install lanka react react-dom zustand
pnpm add     lanka react react-dom zustand
yarn add     lanka react react-dom zustand
bun  add     lanka react react-dom zustand
```

**The peers are listed on purpose.** `react` 19 and `zustand` 5 are peer
dependencies, and only npm installs those for you. Under pnpm, yarn or bun a
missing peer is a warning at install time and a resolution error at build time —
name them once and the question never comes up.

> [!NOTE]
> Any package manager works, and nothing in the framework knows which one you
> used. The one place they differ is the line above; the second is how you run a
> package's binary, which [`@lankajs/tool-skills`](../tools/skills/GUIDE.md#install)
> spells out for each.

TypeScript is not required, but every API is written for it and the types are the
documentation of last resort.

## Your first application

One line:

```ts
import { startLanka } from "lanka";

const lanka = await startLanka({ apiBaseUrl: "https://api.example.com" });
```

That creates the instance, activates it, installs any plugins and awaits
bootstrap.

**Every field is optional, `apiBaseUrl` included.** `await startLanka()` is a
working application: with no base URL a gateway's paths are used as written,
which is what you want when the app is served from its API's origin, or when it
talks to several APIs and each gateway names its own. What the framework will
never do is guess a default like `/api` — that would be silently wrong for
everyone who does not use it, and the symptom is a 404 three layers from the
cause.

Everything else is a field on the same call:

```ts
const lanka = await startLanka({
	apiBaseUrl: import.meta.env.VITE_API_URL,
	messages: { networkErrorMessage: () => "No connection" },
	flags: { isDevelopment: import.meta.env.DEV },
	plugins: [lankaHttp(lankaTokenSessionPolicy({ auth }))],
	services: [{ name: "session", init: () => restoreSession() }],
});
```

Pass `host` instead of `apiBaseUrl` when the copy is yours from the start —
`ILankaHost` requires all four members, so a missing translator is a compile
error rather than an untranslated string in somebody's interface.

### Starting inside Next, React Router or Expo

`startLanka` starts ONE instance, which is exactly right in a browser and wrong
on a server: a process there serves many users, and one instance would be shared
between them. If your host framework renders on a server, the instance is created
per request instead — `runLankaRequest` and `runLankaStatic` in
[@lankajs/host](../modules/host/GUIDE.md) — and this call stays for the browser
half. The two do not conflict; they answer for different sides of the network.

### When one line is not enough

`startLanka` is `createLanka` and `bootstrap` in the order that works. Write
them out when something has to happen between the two — registering a singleton
whose construction reads a service's result, say:

```ts
const lanka = createLanka({ host, flags }); // already active from here
lanka.locators.singletons.register("SessionService", SessionService);
await lanka.bootstrap({ services });
```

Two things are worth knowing whichever way you start:

1. **`createLanka()` activates the instance itself.** `lanka.activate()` exists
   for the case with two instances in one process — a test beside the app — where
   you say which one is ambient. A single-instance application never calls it.
2. **`bootstrap()` brings up the scenario layer.** You do not call
   `lankaScenarioBootstrap` yourself: bootstrap does it, after the async services
   by default and in the ordered phase under `scenarios: { sync: true }`.

What must be in order: register a name before constructing whatever resolves it,
and let ViewModels with `scenarioHandlers` exist before bootstrap runs — it binds
what exists when it runs.

In React, do this once at the module top level of your entry file, or in an
effect in a root component that also calls `lanka.dispose()` on unmount.

## The layers, and which way imports go

```
View (React)          renders. Reads one hook and nothing else.
   │
   ▼
ViewModel             owns state and actions. Calls gateways, triggers scenarios.
   │
   ▼
Gateway               states endpoints. No state, no error policy.
   │
   ▼
Request / Transport   what a response IS, and how bytes travel.
```

**Imports go one way.** A ViewModel may reach a gateway; a gateway does not know
ViewModels exist. This is not an agreement — [`@lankajs/tool-eslint`](../tools/eslint/GUIDE.md)
names the file and the line.

| Layer               | May use                                       | Must never                                   |
| ------------------- | --------------------------------------------- | -------------------------------------------- |
| View                | its ViewModel's hook                          | import a gateway; own loading or retry state |
| ViewModel           | gateways, services, scenarios, a shared store | import another ViewModel                     |
| Gateway             | its request, a validator, a mock handler      | import another gateway; hold state           |
| Request / Transport | `fetch`, or whatever you supply               | know an endpoint or a domain type            |

Two things sit **across** the layers rather than inside one:

- **Scenarios** are how two ViewModels reach each other without importing
  anything. One triggers a fact; the others subscribe.
- **The locator** holds singletons, gateways, shared stores and scenarios by
  name, so a screen asks for a name and never learns where the object came from.

And one thing points **inward**, from your application into the framework: the
`.lanka_di/` barrels. That is the single permitted inversion, and it holds
because there is exactly one reading side — the framework. Your own code
resolves through the locator instead.

### Deciding where a new file goes

Three questions, and the answer to all three is usually forced:

**① What kind of work does it do?**

| The work                               | Where it lives |
| -------------------------------------- | -------------- |
| talks to a server, a storage, an SDK   | a gateway      |
| remembers something, decides something | a ViewModel    |
| draws the screen                       | a component    |
| pure input → output, no memory         | a plain helper |
| announces "something happened"         | a scenario     |

One file doing two of these is two files in a trench coat.

**② Who may use it?** Pick the smallest scope that fits today: one component →
one screen → one feature → the whole app.

**③ Which way does it point?** Downward, toward the more general. A screen may
use a helper; a helper may never use a screen.

## The instance

`createLanka()` returns an `ILankaInstance`, and it owns **all** framework state:
the event bus, the scenario registries, four locator caches, the config and the
in-flight request counter.

| Method                     | What it does                                           |
| -------------------------- | ------------------------------------------------------ |
| `activate()`               | Makes this instance the one ambient facades resolve    |
| `bootstrap(config?)`       | Runs services and the scenario layer. Idempotent       |
| `isBootstrapped()`         | Has it run yet                                         |
| `resolve<T>(name)`         | Resolves a service in the root scope                   |
| `createScope()`            | A lifetime shorter than the application's              |
| `use(plugin)`              | Installs a plugin; returns a remover                   |
| `useRequestMiddleware(mw)` | Wraps every request; returns a remover                 |
| `setRequestTimeout(ms)`    | Default timeout for this instance's requests           |
| `dispose()`                | Unsubscribes, clears registries and the ambient point  |
| `locators`                 | `.singletons` `.gateways` `.scenarios` `.sharedStores` |

Because state lives on the instance and not in module variables, two applications
can run in one process — an app beside Storybook, a test beside another test —
without sharing a bus or a cache.

### Bootstrap services

```ts
await lanka.bootstrap({
	services: [
		{ name: "config", init: loadConfig, sync: true, priority: 10 },
		{ name: "analytics", init: startAnalytics, optional: true, timeoutMs: 2000 },
	],
});
```

- `sync: true` runs the service in the ordered phase; the default phase is
  parallel.
- `priority` orders the sync phase, higher first.
- `optional: true` means a failure does not abort bootstrap. Without it, one
  failed service takes the whole phase with it — and that is usually what you
  want, because an app that starts on a half-executed plan does not know it.
- `timeoutMs` is a deadline. A service that never settles would otherwise hold
  the first paint forever.

## The host contract

```ts
interface ILankaHost {
	apiBaseUrl: string;
	httpErrorMessage(status: number): string;
	networkErrorMessage(): string;
	timeoutErrorMessage(): string;
}
```

All four fields are required on purpose. Each is a product decision the framework
cannot make for you — the copy is yours, the base URL is your build's — and a
missing one is a compile error in the single place a host is passed, rather than
an `undefined` inside a request URL.

Read it anywhere with `getLankaHost()`.

## Flags

```ts
import { getLankaFlags } from "lanka/config";

if (getLankaFlags().isDevelopment) {
	// …
}
```

| Flag                                                                                  | Effect                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `isMockMode`                                                                          | Gateway mock handlers answer instead of the network |
| `isProduction`                                                                        | Silences all log output, disables mocks             |
| `isDevelopment`                                                                       | Enables development-only behaviour                  |
| `loggerEnabled`                                                                       | Master switch for the logger                        |
| `loggerGateway`, `loggerScenario`, `loggerViewModel`, `loggerView`, `loggerBootstrap` | Per-channel switches                                |

Wire them from your bundler: `flags: { isProduction: import.meta.env.PROD }`.

## Gateways — talking to a server

A gateway states the endpoints an application has and nothing else: no state, no
error handling, no decisions about what a failure means. Those belong to the
ViewModel that calls it — which is why gateways stay short.

**As a class:**

```ts
import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";

export class TodoGateway extends ALankaGateway {
	constructor() {
		// No request, no transport: a gateway that says nothing talks JSON over
		// `fetch`. Supply one when this gateway is not ordinary — see below.
		super({ basePath: "/todos" });
	}

	list(): Promise<ITodo[]> {
		return this.request<ITodo[]>(this.endpoint());
	}

	byId(id: number): Promise<ITodo> {
		return this.request<ITodo>(this.endpoint(String(id)));
	}

	search(term: string): Promise<ITodo[]> {
		const query = this.buildQueryParams({ q: term, tags: ["open"] });
		return this.request<ITodo[]>(this.endpoint(`?${query.toString()}`));
	}
}
```

**As a factory** — the same object, without writing a class:

```ts
import { createLankaGateway } from "lanka/gateway";

export const createTodoGateway = () =>
	createLankaGateway({
		basePath: "/todos",
		methods: ({ endpoint, request, buildQueryParams }) => ({
			list: () => request<ITodo[]>(endpoint()),
			byId: (id: number) => request<ITodo>(endpoint(String(id))),
			search: (term: string) =>
				request<ITodo[]>(endpoint(`?${buildQueryParams({ q: term }).toString()}`)),
		}),
	});
```

Both build the _same_ class. Pick the one your team reads more easily; a fix to
the framework reaches both at once.

`endpoint(path)` prefixes `apiBaseUrl` and the gateway's `basePath`, normalising
slashes. Pass an absolute URL and it is used as given.

### Requests and transports

A **request** decides what a response _is_; a **transport** decides how bytes
travel. Three of each ship with core:

| Request                     | Answers            |
| --------------------------- | ------------------ |
| `LankaFetchJsonRequest`     | parsed JSON        |
| `LankaFetchRequest`         | the raw `Response` |
| `LankaFetchFormDataRequest` | multipart uploads  |

Each has a factory twin — `createLankaFetchJsonRequest(…)` and so on — and each
takes a matching transport (`LankaFetchTransport`, …). Supply your own by
implementing `ILankaTransport`; the gateway is typed against the port, not the
implementation.

### Request middleware

```ts
const remove = lanka.useRequestMiddleware(async (ctx, next) => {
	const started = performance.now();
	const result = await next(ctx);
	report(ctx.url, performance.now() - started);
	return result;
});
```

Middleware is a **wrapper**, not a set of hooks, because retry cannot be
expressed with `onRequest` / `onResponse` / `onError`: an error hook can replace
an error but cannot run the request again. Registered first wraps the rest. This
is exactly how [`@lankajs/plugin-http`](../plugins/http/GUIDE.md) installs retry,
auth refresh, the CSRF header and idempotency keys.

### Cancellation and timeouts

`execute` accepts `signal` and `timeoutMs`. The framework merges your signal with
its own timer into one signal and still tells the two apart: a timed-out request
raises `timeout` and is shown to the user, a caller-aborted one raises `aborted`
and stays silent, because the user has already left.

### Counting requests in flight

```ts
import { lankaHttpInFlight } from "lanka/gateway";

lankaHttpInFlight.subscribe((count) => setBusy(count > 0));
```

## Failure

Every failure that leaves a request is a `LankaError` with a **tagged kind**:

| Kind      | Means                      | The interface usually       |
| --------- | -------------------------- | --------------------------- |
| `network` | never reached the server   | offers a retry              |
| `timeout` | reached it, no answer came | offers a retry              |
| `aborted` | the caller cancelled       | shows nothing               |
| `http`    | the server said no         | shows the server's message  |
| `schema`  | the body did not match     | reports a break, not a typo |
| `domain`  | your own rule refused      | shows your message          |

```ts
import { LankaError, createLankaApiError, handleLankaApiError } from "lanka/errors";

try {
	await gateway.list();
} catch (error) {
	if (error instanceof LankaError && error.kind === "aborted") return;
	setError(handleLankaApiError(error));
}
```

Refuse locally with the same shape rather than a bare `throw`, so a screen has
one failure shape to render:

```ts
if (term.trim().length === 0) {
	return Promise.reject(createLankaApiError(400, ["a search needs a term"]));
}
```

## Validating a response

The validator accepts **any** schema implementing
[Standard Schema](https://standardschema.dev) — zod 4, valibot, arktype. There
are no adapter classes: a schema describes itself.

```ts
async listValidated(): Promise<ITodo[]> {
    const body = await this.request<unknown>(this.endpoint());
    return lankaStandardValidator.validate(todoSchema, body, "todos.list");
}
```

The third argument is a label. It appears in the `LankaValidationError` and in
the log, and it is what turns "invalid response" into "which call".

Because Standard Schema's `validate` returns the _transformed_ value, mapping a
legacy wire format is just a second schema — there is no adapter layer, because
there is nothing for it to do:

```ts
const domain = lankaStandardValidator.validate(todoApiSchema, wire, "todos.map");
return lankaStandardValidator.validate(todoSchema, domain, "todos.check");
```

An async schema is rejected loudly. A synchronous port cannot await one, and
answering "fine" would let unvalidated data through.

## ViewModels

A ViewModel owns a screen's state and the actions that change it. What you get
back is a React hook: `const { todos, isLoading, load } = useTodosVM();`

**As a factory:**

```ts
import { createLankaVM } from "lanka/viewmodel";

export const createTodosVM = (todoGateway: TodoGateway) =>
	createLankaVM<ITodosState, ITodoActions, { todoGateway: TodoGateway }>({
		name: "TodosVM",
		states: { todos: [], error: null, isLoading: false },
		gateways: () => ({ todoGateway }),

		createActions: ({ set, get, gateways, trigger }) => ({
			load: async () => {
				set({ isLoading: true, error: null });
				try {
					set({ todos: await gateways.todoGateway.list() });
				} finally {
					set({ isLoading: false });
				}
			},
			complete: (id: number) => {
				set({ todos: markDone(get().todos, id) });
				trigger(todoCompleted, { id });
			},
		}),

		scenarioHandlers: [
			{
				scenario: todoCompleted,
				handler:
					({ set, get }) =>
					(data?: { id: number }) => {
						if (!data) return;
						set({ todos: markDone(get().todos, data.id) });
					},
			},
		],
	});
```

**As a class** — same behaviour, written against `this`:

```ts
import { ALankaVM } from "lanka/viewmodel";

export class TodosVM extends ALankaVM<ITodosState, ITodoActions, ITodoGateways> {
	protected readonly name = "TodosVM";

	private readonly gateway: TodoGateway;

	constructor(gateway: TodoGateway) {
		super();
		this.gateway = gateway;
	}

	protected override states(): ITodosState {
		return { todos: [], error: null, isLoading: false };
	}

	protected override createGateways(): ITodoGateways {
		return { todoGateway: this.gateway };
	}

	protected createActions(): ITodoActions {
		return {
			load: async () => {
				this.set({ isLoading: true });
				try {
					this.set({ todos: await this.gateways.todoGateway.list() });
				} finally {
					this.set({ isLoading: false });
				}
			},
		};
	}
}

export const useTodosVM = new TodosVM(gateway).build();
```

The protected surface is exactly the factory's context — `set`, `get`,
`gateways`, `services`, `trigger` — and that is enforced, not a convention. The
overridable hooks are `states`, `createGateways`, `createServices`,
`scenarioHandlers`, `enhancers`, `onInit`, `onReset` and `createActions`.

### Config reference

| Field                              | Meaning                                             |
| ---------------------------------- | --------------------------------------------------- |
| `name`                             | Shown in logs and devtools. Required                |
| `states`                           | The initial state. Omit for a stateless ViewModel   |
| `createActions`                    | Receives the context, returns the actions           |
| `gateways` / `services`            | An object or a factory; reachable as `gateways.x`   |
| `scenarioHandlers`                 | `{ scenario, handler }` pairs, bound at bootstrap   |
| `enhancers`                        | Store enhancers, zustand style                      |
| `onInit` / `onReset`               | Lifecycle hooks over the same context               |
| `enableAccessTrackingOptimization` | Default on; see [common mistakes](#common-mistakes) |

### Using one in a component

```tsx
const TodoScreen = () => {
	const { todos, isLoading, load } = useTodosVM();
	useEffect(() => {
		void load();
	}, [load]);
	return isLoading ? <Spinner /> : <List items={todos} />;
};
```

The hook re-renders a component only for the keys it actually **read**. That is
usually free performance, and it has one blind spot, described at the end of this
guide.

## Choosing a coordination tool

When "A must affect B", one question decides it: **do A and B co-own a thing, or
does A announce something to independent Bs?**

| The link                                                   | The tool           |
| ---------------------------------------------------------- | ------------------ |
| one screen owns the state and nothing else needs it        | one ViewModel      |
| A announces a fact; B, C and D each react in their own way | a **scenario**     |
| A and B edit the same in-flight thing before it is saved   | a **shared store** |

Read it in that order and stop at the first that fits. The commonest mistake is
reaching past the first two: two ViewModels wired directly, or a shared store for
what is really an announcement.

A scenario carries something that **happened**. A shared store holds something
being **co-edited** — a two-step form's draft, a selection two panels must agree
on. If you would describe the link with a verb in the past tense, it is a
scenario.

## Shared stores

When two screens must not disagree — a selection, a draft, a filter — put the
state in a shared store and give each screen its own ViewModel over it.

```ts
import { ALankaSharedStore, ALankaSharedStoreVM } from "lanka/viewmodel";

export class TodoStore extends ALankaSharedStore<ISelection> {
	constructor() {
		super(() => ({ selectedId: null }));
	}
}

export class BadgeVM extends ALankaSharedStoreVM<ISelection, IBadgeActions, TodoStore> {
	protected readonly name = "BadgeVM";

	protected createActions(): IBadgeActions {
		return {
			select: (id: number) => {
				this.set({ selectedId: id });
			},
			clear: () => {
				this.set({ selectedId: null });
			},
		};
	}
}
```

The factory twins are `createLankaSharedStore` and `createSharedStoreLankaVM`.

Each ViewModel owns its **actions**; the **state** lives once, in the store, so
two readers cannot drift apart. Passing the value down as props works for one hop
and breaks at the second; duplicating it into both ViewModels produces two
answers to one question.

## Stateless ViewModels

Roughly half the ViewModels an application writes hold nothing — they answer
questions about data somebody else owns. Give them no store at all, or every
consumer re-renders on changes to a state that cannot change.

```ts
import { createStatelessLankaVM } from "lanka/viewmodel";

export const createStatsVM = () =>
	createStatelessLankaVM<IStatsActions>({
		name: "StatsVM",
		createActions: () => ({
			countDone: (todos: readonly ITodo[]) => todos.filter((todo) => todo.done).length,
		}),
	});
```

The class twin is `ALankaStatelessVM`.

## Lazy ViewModels

`createLazyLankaVM`, `createLazyStatelessLankaVM` and
`createLazySharedStoreLankaVM` build on first use rather than at module load. Use
them for a screen behind a route most sessions never open.

```ts
const useSettingsVM = createLazyLankaVM({/* … */});
// nothing is built yet
useSettingsVM.dispose(); // drops the store and its subscriptions
```

**Lazy variants are factory-only, deliberately.** Lazy is a _lifetime_, not a
role — there is nothing extra to subclass.

`dispose()` matters here: a lazy ViewModel subscribes to scenarios on first use,
and without explicit disposal that subscription outlives the screen.

## Scenarios — cross-screen facts

A scenario names a **fact**, not an action: `TodoCompleted`, not `CompleteTodo`.
Whoever changes something triggers it; whoever cares subscribes. Neither screen
imports the other — that is the whole reason the layer exists.

```ts
import { ALankaScenario } from "lanka/scenario";

export class TodoCompleted extends ALankaScenario<{ id: number }> {
	readonly name = "TodoCompleted";
	readonly eventType = "todo:completed";
	readonly dataTypeName = "ITodoCompleted";
}

export const todoCompleted = new TodoCompleted();
```

Keep the single instance beside its class. A second instance is a second event
nobody listens to — silence, not an error.

**As a factory**, when the body is only data, which is most of the time:

```ts
import { createLankaScenario } from "lanka/scenario";

export const todoCompleted = createLankaScenario<{ id: number }>({
	name: "TodoCompleted",
	eventType: "todo:completed",
	dataTypeName: "ITodoCompleted",
});
```

A ViewModel subscribes through `scenarioHandlers` and fires through
`trigger(scenario, data)`.

> [!NOTE]
> Binding happens inside `bootstrap()`, which `startLanka` awaits for you. What
> matters is that a ViewModel carrying `scenarioHandlers` exists **before** that
> runs — bootstrap binds what exists when it runs.

### The bus directly

```ts
import { lankaEventBus } from "lanka/scenario";

const off = lankaEventBus.subscribe<ITodo>("todo:completed", onCompleted, {
	replay: "last",
	priority: 10,
});
```

Things worth knowing:

- **Buffering happens on request only.** Depth is the maximum of what the event
  declares (`registerEvent({ replay: N })`) and what subscribers ask for; when
  the last asker leaves, the buffer is cleared. Nothing is buffered "just in
  case", because that means holding personal data in memory with no consumer.
- **`replay` counts values:** `false | "last" | N`.
- **`subscribe` returns an unsubscribe** that removes exactly that subscription.
  Removing by callback cannot tell two subscriptions of one function apart.
- **Delivery iterates a copy** of the subscriber list, so a handler may
  unsubscribe itself mid-delivery. The deliberate consequence: subscribing
  _during_ delivery waits for the next event.
- **Middleware returns a decision** — `"pass"` or `{ stop: reason }` — never
  `next()`. A middleware that forgot to call `next()` would make the event vanish
  silently, and a mechanism that exists for observability must not be its own
  blind spot. A stop is written to the event log; so is a throw.

## The locator

Four registries, one per kind of object, each reachable by name — so a screen
never learns where an object came from, which is what makes it replaceable in a
test.

```ts
lanka.locators.singletons.register("SessionService", SessionService);
lanka.locators.gateways.registerInstance("TodoGateway", todoGateway);

const session = lanka.resolve<SessionService>("sessionService");
```

Ambient access, for code that cannot hold an instance:

```ts
import { lankaSingletons, lankaGateways } from "lanka/locator";

lankaSingletons.sessionService.signIn("ada");
void lankaGateways.todoGateway.list();
```

A name nobody registered is a **named refusal**, not `undefined`.

### Declaring a singleton

```ts
import { ALankaSingleton, createLankaSingleton } from "lanka/locator";

export class SessionService extends ALankaSingleton {
	private who: string | null = null;

	signIn(name: string): void {
		this.who = name;
	}
}

export const Clock = createLankaSingleton<IClock>(() => {
	let seen = 0;
	return { ticks: () => (seen += 1) };
});
```

Extending the marker is not ceremony. Without it, "a singleton" means "any
exported function with a prototype", and a stray export in a barrel silently
becomes part of the public `lankaSingletons.*`.

### Typed ambient access

`lankaGateways.todoGateway` is typed when your application publishes `.lanka_di/`
barrels — see [`@lankajs/tool-di`](../tools/di/GUIDE.md). Without them the
facades still work; they are just untyped.

## Scopes

```ts
const scope = lanka.createScope();
const vm = scope.resolve<ScreenVM>("screenVM");
scope.dispose();
```

A scope is a lifetime shorter than the application's: what it created goes away
with it. It resolves **only its own** objects — a scope that could hand out
others' would make closing a screen break the app. Resolving from a closed scope
is refused loudly, because it is almost always a reference that outlived its
screen.

## Mock mode

```ts
list(): Promise<ITodo[]> {
    const mock = createLankaMockHandler(
        () => import("../mocks/todoMocks"),
        (module) => module.todoMocks,
        "todos.list",
        0,
    );
    if (mock) return mock();

    return this.request<ITodo[]>(this.endpoint());
}
```

`createLankaMockHandler` returns `undefined` while mock mode is off — so the
branch disappears, the dynamic import is never reached, and **a production bundle
contains no mock data**, because nothing in it can refer to the module.

Always pass the name. Deriving it from the stack trace works only until
minification, and mock mode is enabled in exactly such a bundle.

## The logger

```ts
import { lankaLogger } from "lanka/logger";

lankaLogger.printGatewayLog("GET /todos", payload);
```

Channels follow the flags: `loggerGateway`, `loggerScenario`, `loggerViewModel`,
`loggerView` and `loggerBootstrap`, all under `loggerEnabled`, and all silent
when `isProduction`. Add a sink (`ILankaLoggerSink`) to ship lines somewhere
other than the console.

## Plugins

A plugin is something **core** calls (`app → core → plugin`); a module is
something **you** call (`app → module`). If core needs no hook for it, it is a
module — and it should stay one, because every extension point is a promise for
the lifetime of a major version.

```ts
import { ALankaPlugin } from "lanka";

class TimingPlugin extends ALankaPlugin {
	readonly name = "timing";

	install(lanka: ILankaInstance) {
		return lanka.useRequestMiddleware(timing); // the returned function uninstalls
	}
}

const remove = lanka.use(new TimingPlugin());
```

`install` receives the instance so a plugin has no private route into the
framework, and two instances in one process do not share its configuration.
Registering the same name twice is refused — two copies of a retry policy would
silently double the request count.

## Roles — both styles for your own layer

Every role in lanka ships as a class _and_ a factory over one implementation. You
can have the same for a layer of your own — a repository, a presenter, a command:

```ts
import { defineLankaRole } from "lanka/role";

export const createRepository = defineLankaRole(openRepository);
```

`openRepository` builds the class and hands back `{ instance, context }`, where
`context` is its protected surface. Write it in the role's own module: `protected`
is readable only from inside a deriving class body, so a generic helper outside
the hierarchy cannot reach it.

## Import map

| Import             | Contains                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| `lanka`            | `createLanka`, `LankaError`, `lankaLogger`, flags, host, `defineLankaRole` |
| `lanka/bootstrap`  | `createLanka`, `ALankaPlugin`, `resetActiveLanka`                          |
| `lanka/config`     | `getLankaHost`, `getLankaFlags`                                            |
| `lanka/errors`     | `LankaError`, `createLankaApiError`, `handleLankaApiError`                 |
| `lanka/gateway`    | gateways, requests, transports, query params, the in-flight counter        |
| `lanka/locator`    | singletons, and the four ambient facades                                   |
| `lanka/logger`     | `lankaLogger`, `LankaLogger`, sinks                                        |
| `lanka/mock`       | `createLankaMockHandler`                                                   |
| `lanka/role`       | `defineLankaRole`                                                          |
| `lanka/scenario`   | scenarios, the event bus, scenario bootstrap                               |
| `lanka/validation` | `lankaStandardValidator`, `LankaValidationError`                           |
| `lanka/viewmodel`  | every ViewModel shape, and shared stores                                   |
| `lanka/extend`     | mechanism for tooling and alternative implementations. Changes in a minor  |
| `lanka/internal`   | primitives shared between lanka packages. Changes in any release           |

Names under the `lanka/*` facades are kept until a major version and are never
removed. Reaching past the facade is possible, deliberate and visible in review —
which beats making it impossible and having people fork the framework.

## What else ships

Core is enough to build an application. Four packages exist to make working on
one easier, and each is optional.

| Package                                            | What it does for you                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`@lankajs/tool-di`](../tools/di/GUIDE.md)           | The `@lanka_di` alias and the barrels. Effectively required in a vite app     |
| [`@lankajs/tool-eslint`](../tools/eslint/GUIDE.md)   | The boundaries above, as lint rules that name the file and the line           |
| [`@lankajs/tool-testing`](../tools/testing/GUIDE.md) | A fresh framework per test, a render helper, two doubles, the bench yardstick |
| [`@lankajs/tool-skills`](../tools/skills/GUIDE.md)   | The agent skills of the packages you installed, in your project               |

### Skills for your coding agent

Every package ships a skill: what it is for, the shapes to write, and the
refusals — the things that look like a missing feature and are the feature. Two
ways to install one:

```bash
# from the framework's repository, in Claude Code
/plugin marketplace add lankajs/lanka
/plugin install lanka-core@lankajs

# or from the packages you already installed — the skill for THAT version
npx lanka-skills sync
```

> [!TIP]
> Prefer the second where it works. A skill installed from git describes the main
> branch; one installed from your `node_modules` describes the code you are
> actually running. Start with `lanka-packages`, which routes to the rest by
> problem.

### The modules and plugins

Nine more packages solve problems you may or may not have — realtime, retry
policy, optimistic updates, list handling, storage, prefetching. The table of
"add it when" is in [ARCHITECTURE.md](../ARCHITECTURE.md#adopting-the-packages),
and each has a guide of its own.

## Cases

### A screen that loads a list

1. **Gateway** — one method per endpoint, validating the body.
2. **ViewModel** — `states` for the list, the flag and the error; an action that
   sets the flag, calls the gateway, and clears the flag in `finally`.
3. **Component** — reads the hook, calls the action in an effect, renders three
   states: loading, error, content.

Nothing else. If you find yourself writing a `useState` for the rows beside the
ViewModel, the ViewModel is the one that should hold them.

### One screen changes something another must see

The change happens in the owner's ViewModel, and it announces a fact:

```ts
complete: async (id: number) => {
	await gateways.todoGateway.complete(id);
	set({ todos: markDone(get().todos, id) });
	trigger(todoCompleted, { id }); // ← the announcement
};
```

Every other ViewModel that cares subscribes through `scenarioHandlers` and
decides for itself what the fact means for its own state. Neither imports the
other.

**Trigger with the data when you have it.** If the server returned the updated
object, put it in the payload — subscribers apply it instead of each refetching.
If the call returned nothing, trigger the bare fact and let each subscriber
decide whether it needs a read.

### A two-step form, and the world afterwards

The case people get wrong, because it needs **three different tools at once**:

| The link                                             | The tool           |
| ---------------------------------------------------- | ------------------ |
| step 1 and step 2 edit one unsaved draft             | a **shared store** |
| "order placed" must clear a badge in the header      | a **scenario**     |
| "order placed" must refresh a list on another screen | the same scenario  |

```
 AddressStep ─┐
              ├─► CheckoutStore (shared)   ← one draft, two editors
 PaymentStep ─┘
       │ user presses "Place order"
       ▼
 PaymentStepVM.placeOrder()
       ├─► orderGateway.place(draft)          ← the only network call
       ├─► trigger(orderPlaced, { order })    ← ONE announcement…
       │        ├─► CartBadgeVM   (subscribed) → clears the badge
       │        └─► OrdersListVM  (subscribed) → applies the order
       ├─► clear the store (the draft is spent)
       └─► navigate to the confirmation
```

Three things worth saying out loud:

- **A shared store between the steps, not a scenario.** They co-own one buffer;
  a scenario is for "this happened", not "we are editing the same thing".
- **A scenario for the badge, not a shared store.** Those are independent owners.
- **The orchestration lives in the ViewModel**, not in the button. The component
  calls `placeOrder()` and stays dumb.

And one that only bites later: if the confirmation screen's ViewModel is
**lazy**, it is not subscribed yet, so the scenario will not reach it. Write what
it needs before navigating, or pass an id in the route.

### A screen behind a route most sessions never open

`createLazyLankaVM`, and `dispose()` when the screen goes. Otherwise its scenario
subscriptions outlive it, and it keeps reacting to facts about a screen nobody is
looking at.

### A service several screens need

Not an import — a name. Register it once at start-up
(`lanka.locators.singletons.register(...)`), reach it as
`lankaSingletons.sessionService`, and a test replaces the object behind the name
without touching a screen.

## Common mistakes

**Building a ViewModel before the framework exists.** It resolves against no
runtime. `startLanka` — or `createLanka` — comes first.

**A scenario handler that never fires.** Either `bootstrap()` was never awaited,
or the ViewModel was constructed after it: bootstrap binds what exists when it
runs.

**Reading state through a getter and wondering why the screen froze.** A consumer
re-renders only for the keys it _read through the proxy_. If a component's only
link to `todos` goes through a getter that calls `get()` internally, that read
happens past the proxy and no re-render follows. There is no error.

In development the framework notices and warns, naming the ViewModel and the key.
The fix is `enableAccessTrackingOptimization: false` on that ViewModel. Do **not**
"fix" it by destructuring for the side effect: that reads as dead code, and the
next refactor or lint autofix deletes it.

**Naming a scenario after an action.** `CompleteTodo` invites the subscriber to
_do_ the completing; `TodoCompleted` states what happened. The second is what
lets three screens react differently without knowing about each other.

**Letting a lazy ViewModel leak.** Call `dispose()` when its screen goes away.

**Validating in the screen instead of the gateway.** A gateway is where a body
stops being `unknown`. Validate anywhere else and the same three guards end up
spread over every consumer, each slightly differently wrong.

## Recap

- **`startLanka({ apiBaseUrl })`** is the whole start-up: create, activate,
  install plugins, bootstrap. Write the two calls out only when something must
  happen between them.
- **Imports go one way.** A ViewModel reaches a gateway; a gateway does not know
  ViewModels exist.
- **A gateway states endpoints** and holds no state — it is also where a body
  stops being `unknown`.
- **A ViewModel owns a screen's state**, and comes in three shapes: stateful,
  stateless, and over a shared store. Each ships as a class and a factory over
  one implementation.
- **For "A must affect B"**, ask whether they co-own a thing (a shared store) or
  A announces something (a scenario). Never an import between ViewModels.
- **`LankaError` carries a kind**, because `aborted` and `network` need different
  things from the interface.
- **What fails loudly does so on purpose**: a name nobody registered, an async
  schema, a mock in production. Those are refusals, not gaps.

---

Recommended architecture: [ARCHITECTURE.md](../ARCHITECTURE.md) · Testing
helpers: [`@lankajs/tool-testing`](../tools/testing/GUIDE.md) · Maintaining
this package: [SKILL.md](./SKILL.md) · Repository map: [../README.md](../README.md)
