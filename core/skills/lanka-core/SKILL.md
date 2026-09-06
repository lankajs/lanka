---
name: lanka-core
description: Write and review code built on the lanka framework — gateways, ViewModels, scenarios, shared stores, the locator, bootstrap and failure handling. Use when a file imports `lanka` or `lanka/*`, when adding a screen that needs data or state, or when diagnosing a lanka app that will not start, a scenario handler that never fires, or a screen that stopped re-rendering.
license: MIT
metadata:
    author: lankajs
    package: lanka
    version: "1.1.1"
---

# lanka — core

Layered React application framework: **gateways → ViewModels → views**, scenarios
over an event bus, a locator for resolution. `reference.md` beside this file is
the full guide; read it when a detail here is not enough.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Start-up — one line

```ts
const lanka = await startLanka({ apiBaseUrl: "https://api.example.com" });
```

Creates, activates, installs plugins, awaits bootstrap. **Every field is
optional** — `await startLanka()` works. With no `apiBaseUrl` a gateway's paths
are used as written, which is what an app on its API's origin or one talking to
several APIs wants; the three failure messages get English defaults you replace
one at a time through `messages`. `plugins`, `services`, `flags` and a whole
`host` are fields on the same call.

Write the two calls out only when something must happen BETWEEN them:

```ts
const lanka = createLanka({ host, flags }); // already active from here
lanka.locators.singletons.register("SessionService", SessionService);
await lanka.bootstrap({ services }); // services, then the scenario layer
```

Neither `lanka.activate()` nor `lankaScenarioBootstrap.bootstrap()` is something
an application calls: `createLanka` activates, `bootstrap` raises the scenario
layer. `activate()` is for choosing between two instances in one process.

What must be in order: **register a name before constructing whatever resolves
it**, and let ViewModels with `scenarioHandlers` exist before `bootstrap()` — it
binds what exists when it runs.

## The layers, and which way imports go

```
View  →  ViewModel  →  Gateway  →  Request / Transport
```

**Imports go one way.** A ViewModel may reach a gateway; a gateway does not know
ViewModels exist. Checked by `@lankajs/tool-eslint`, which names the file and the
line.

| Layer               | May use                                       | Must never                                   |
| ------------------- | --------------------------------------------- | -------------------------------------------- |
| View                | its ViewModel's hook                          | import a gateway; own loading or retry state |
| ViewModel           | gateways, services, scenarios, a shared store | import another ViewModel                     |
| Gateway             | its request, a validator, a mock handler      | import another gateway; hold state           |
| Request / Transport | `fetch`, or whatever the app supplies         | know an endpoint or a domain type            |

**Scenarios** and **the locator** sit across the layers: a scenario is how two
ViewModels reach each other without importing anything, the locator is how a
screen asks for a name instead of an object. The only inversion is `.lanka_di/`,
read by the framework and by nobody else.

### Where does a new file go?

| The work it does                   | Where it lives |
| ---------------------------------- | -------------- |
| talks to a server, storage, an SDK | a gateway      |
| remembers or decides something     | a ViewModel    |
| draws the screen                   | a component    |
| pure input → output, no memory     | a plain helper |
| announces "something happened"     | a scenario     |

One file doing two of these is two files in a trench coat. Then pick the smallest
scope that fits today, and point downward — a screen may use a helper, a helper
may never use a screen.

## Which shape do I need?

| The need                                   | The shape                                        |
| ------------------------------------------ | ------------------------------------------------ |
| talk to a server                           | a gateway                                        |
| a screen's state and actions               | `createLankaVM` / `ALankaVM`                     |
| answer questions about someone else's data | `createStatelessLankaVM` — no store at all       |
| two screens must not disagree              | `ALankaSharedStore` + `createSharedStoreLankaVM` |
| a screen behind a route most never open    | `createLazyLankaVM`, and call `dispose()`        |
| one screen must react to another's change  | a scenario — never an import between ViewModels  |
| a service resolved by name                 | `ALankaSingleton` / `createLankaSingleton`       |

Every role ships **both** a class and a factory over one implementation. Pick the
style the project already uses; do not mix them for one role.

## Gateway — endpoints and nothing else

```ts
export class TodoGateway extends ALankaGateway {
	constructor() {
		super({ basePath: "/todos" }); // JSON over fetch, unless you say otherwise
	}

	list(): Promise<ITodo[]> {
		return this.request<ITodo[]>(this.endpoint());
	}
}
```

No state, no error handling, no decisions about what a failure means — those
belong to the ViewModel that calls it. A gateway **is** where a body stops being
`unknown`: validate here with `lankaStandardValidator.validate(schema, body, "todos.list")`,
never in the screen.

## ViewModel — state, actions, subscriptions

```ts
export const createTodosVM = (todoGateway: TodoGateway) =>
	createLankaVM<ITodosState, ITodoActions, { todoGateway: TodoGateway }>({
		name: "TodosVM",
		states: { todos: [], isLoading: false },
		gateways: () => ({ todoGateway }),
		createActions: ({ set, get, gateways, trigger }) => ({
			load: async () => {
				set({ isLoading: true });
				try {
					set({ todos: await gateways.todoGateway.list() });
				} finally {
					set({ isLoading: false });
				}
			},
		}),
		scenarioHandlers: [{ scenario: todoCompleted, handler: ({ set, get }) => (data) => { … } }],
	});
```

**Naming a scenario through the locator? Declare the handlers as a FACTORY.**
`scenarioHandlers: () => [{ scenario: lankaScenarios.todoCompleted, … }]` is read
at bind time. The array form is built where it is written, and for a ViewModel at
module level that is before `createLanka` can have run. Import order is not a
defence: it holds inside one chunk and a bundler decides chunks — the body of an
imported chunk runs before the body of the chunk importing it. `gateways` and
`services` accept a factory for the same reason.

The class form has the same surface as protected members: `this.set`, `this.get`,
`this.gateways`, `this.services`, `this.trigger`.

Consuming it is a hook: `const { todos, load } = useTodosVM();`

## Scenario — a FACT, not a command

```ts
export const todoCompleted = createLankaScenario<{ id: number }>({
	name: "TodoCompleted",
	eventType: "todo:completed",
	dataTypeName: "ITodoCompleted",
});
```

Name it after what happened (`TodoCompleted`), not after what to do
(`CompleteTodo`) — that is what lets three screens react differently without
knowing about each other. Keep exactly one instance per scenario; a second one is
an event nobody listens to.

## "A must affect B" — pick the tool by one question

**Do A and B co-own a thing, or does A announce something to independent Bs?**

| The link                                                 | The tool           |
| -------------------------------------------------------- | ------------------ |
| one screen owns the state, nothing else needs it         | one ViewModel      |
| A announces a fact; B, C, D each react their own way     | a **scenario**     |
| A and B edit the same in-flight thing before it is saved | a **shared store** |

Read in that order, stop at the first that fits. If the link is describable with
a past-tense verb, it is a scenario.

## Cases

**A screen that loads a list.** Gateway method → ViewModel action that sets the
flag, calls it, clears the flag in `finally` → component reads the hook and
renders loading / error / content. A `useState` for the rows beside the ViewModel
means the ViewModel should have held them.

**One screen changes something another must see.** The owner's action writes its
own state and then `trigger(fact, payload)`. Others subscribe through
`scenarioHandlers` and each decides what the fact means for itself. Trigger
_with_ the data when the server returned it — subscribers apply instead of
refetching.

**A two-step form, and the world afterwards.** Three tools at once: a **shared
store** for the draft the two steps co-edit, one **scenario** for "order placed"
that a header badge and a list on another screen both subscribe to, and the
orchestration — gateway, trigger, clear the store, navigate — in the ViewModel
rather than the button. If the next screen's ViewModel is **lazy** it is not
subscribed yet, so write what it needs before navigating.

**A screen behind a rarely-opened route.** `createLazyLankaVM`, and `dispose()`
when it goes, or its subscriptions outlive it.

**A service several screens need.** Register a name at start-up, reach it as
`lankaSingletons.sessionService`. A test then replaces the object behind the name
without touching a screen.

## Failure

`LankaError` carries a kind: `network` · `timeout` · `aborted` · `http` ·
`schema` · `domain`. Branch on it. `aborted` is shown to nobody — the user left.

Refuse locally with the same shape rather than a bare throw:
`Promise.reject(createLankaApiError(400, ["a search needs a term"]))`.

## Never do these

- **Never import one ViewModel from another.** Use a scenario; a shared store
  only when several must co-edit one state.
- **Never call a gateway from a component.** The component then silently owns
  loading, failure and cancellation, and owns none of them.
- **Never let one gateway call another.** Compose in the ViewModel, where the
  order and the failure are visible.
- **Never construct a ViewModel before the framework exists.** It resolves
  against no runtime; `startLanka` (or `createLanka`) comes first.
- **Never validate a response outside the gateway.**
- **Never `import` your own `.lanka_di` barrels.** They are the framework's one
  reading side.
- **Never leave a lazy ViewModel undisposed.**

## Symptom → cause

| What you see                         | What it is                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| a scenario handler never fires       | `lanka.bootstrap()` was never awaited, or the ViewModel was built after it                                             |
| a locator name resolves to a refusal | registered after construction, or never registered                                                                     |
| the screen freezes with no error     | a key read through a getter, past the tracking proxy — set `enableAccessTrackingOptimization: false` on that ViewModel |
| "module not found" for `@lanka_di/…` | `@lankajs/tool-di` is not installed, or the alias is missing                                                             |
| a test sees another test's events    | the instance was replaced without `dispose()` — use `resetLanka()`                                                     |
| "lanka used before an instance existed", only in a BUILT bundle | a ViewModel read the locator while its own module was evaluated, ahead of `createLanka` — declare `scenarioHandlers` as a factory (below) |

Do **not** fix the frozen screen by destructuring a value "for the side effect":
it reads as dead code and the next refactor deletes it.

## More

`reference.md` — the full guide: host contract, flags, transports, middleware,
scopes, mock mode, the logger, plugins, roles, and the complete import map.
