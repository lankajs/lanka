# Parity

Every ROLE this framework defines is written in two styles — a class and a
factory — over one implementation, and neither style can do anything the other
cannot. Everything else is reachable from both styles without a second name.

`skills/forms/SKILL.md` decides what shape a thing has. This skill decides how a
consumer REACHES it, and how a project pins that choice down for its own team.

## Why two styles

The code written on this framework is written by two populations. One reaches
for `class X extends Base` with `protected` hooks, `this` and `super`. The other
reaches for `createX({ ... })` with an options object and closures. Shipping one
of them tells half the users their idiom is wrong here.

The evidence is in the two applications this framework grew out of, and it is
not a preference — it is per LAYER, and both applications chose identically:

| Layer              | What they actually write                                      | How many                            |
| ------------------ | ------------------------------------------------------------- | ----------------------------------- |
| gateway            | `class extends AGateway`                                      | every one, in both apps             |
| ViewModel          | `createViewModel({ ... })`                                    | 41 in one app, as many in the other |
| scenario           | `class extends AScenario` — a body of three `readonly` fields | every one                           |
| table / collection | subclassing one concrete class                                | 27 screens in one app               |

Two facts fall out. Applications pick a style per layer and hold it — which is
what §5 turns into a project setting. And a scenario is written as a class whose
body is pure data, which is the clearest case in the repository for a factory
being the better default.

The model to copy is **Node**: subclass `Readable` and implement `_read`, or
hand `read` to the constructor — one implementation, two ways in. The cautionary
tale is **React**, where class components and hooks were never brought to parity
and the class style froze, not by a decision but by a backlog.

## The five rules

1. **A role ships both forms.** A role is what a consumer writes many of.
2. **One implementation.** The factory is built ON the class, never beside it.
3. **A class's `protected` surface and a factory's context are the same names.**
4. **Everything else is reachable from both styles without a second name** — §4.
5. **A capability arrives in both styles in one commit, or in neither.**

---

## 1. What is a role

A role is something the framework named and the consumer writes MANY of: a
gateway per endpoint family, a scenario per fact, a ViewModel per screen, a
plugin, a bridge, a bootstrap step, a shared store, a singleton, a request kind.

Nine of them. That is the whole list, and it is the list §6 checks.

Everything else — an operation over values, a ready-made table, a thing held once
per application — is not a role and does not get a second name. §4 is how those
are reached from either style.

---

## 2. The triple

```
ILankaGateway          the contract
ALankaGateway          class style — extend it, implement the protected hooks
createLankaGateway     functional style — call it, pass the same hooks as options
```

```ts
class TodoGateway extends ALankaGateway<RequestInit> {
	list(): Promise<ITodo[]> {
		return this.requestExecutor.execute<ITodo[]>(this.endpoint());
	}
}
```

```ts
const todoGateway = createLankaGateway({
	request: createLankaFetchJsonRequest({ transport }),
	basePath: "/todos",
	methods: ({ endpoint, request }) => ({
		list: () => request<ITodo[]>(endpoint()),
	}),
});
```

The context `{ endpoint, request }` is the class's `protected` surface handed
over as an object. That is what makes rule 3 checkable, and it is why a hook
takes ONE object rather than positional arguments: widening the context then
breaks nobody.

---

## 3. `defineLankaRole` — the tool, and it is published

The bridge between the two styles is one shape, and a consumer defining a role of
their OWN gets it from core rather than writing it:

```ts
// The role's own module — the only place `protected` may be read.
const openAuditLog = (config: IAuditLogConfig) => {
	class Opened extends APlaygroundAuditLog {
		public open() {
			return { instance: this, context: this.toStyleContext() };
		}
	}

	return new Opened(config).open();
};

export const createPlaygroundAuditLog = defineLankaRole(openAuditLog);
```

`defineLankaRole` takes that opener and answers the factory. Called with `build`,
it hands the context over and returns what the hooks returned; called without, it
answers the instance itself — which is what a role whose whole body is data needs.

### 3a. Why the opener lives in the role's module

`protected` is readable from inside a class body deriving from the base, and
nowhere else. A generic helper cannot reach it, and a base that made
`toStyleContext` public would put its whole extension surface on every object a
consumer writes — the wrong half, permanently.

### 3b. Where the framework spells the bridge out by hand

Most of the nine roles are GENERIC in their own parameters: a gateway in its
request options, a ViewModel in its state, its actions and its gateways.
`defineLankaRole` answers a factory whose parameters are already fixed, so a
generic role could pass through it only by pinning what the caller must infer.
Those roles write the same bridge inline, in the factory's module:

```ts
export const createLankaGateway = <TOptions, TMethods extends object>(
	config: ILankaGatewayConfig<TOptions, TMethods>,
): TMethods => {
	class FunctionalGateway extends ALankaGateway<TOptions> {
		public build(): TMethods {
			return config.methods(this.toStyleContext());
		}
	}

	return new FunctionalGateway(config).build();
};
```

Three lines, and the same guarantee: the factory IS a subclass, so a divergence
cannot be written. What differs is only who declares the generics.

The bridge belongs to the FACTORY's module and not to the base — that is a
measured constraint, not taste. `toStyleContext` declared on `ALankaGateway`
itself made the class invariant in `TOptions`, and the locator's
`ALankaGateway<unknown>` stopped accepting a consumer's gateway.

## 4. Everything that is not a role

**An object-style entry already exists and costs nothing:**

```ts
import * as lankaCollection from "@lankajs/collection";

lankaCollection.compare(a, b);
lankaCollection.createView({ getValue });
```

A namespace import gives `object.method` reading with FULL tree-shaking, because
a bundler resolves the members statically. A hand-written namespace object would
read identically and retain the whole package — this is `lodash` against
`lodash/get` — so the framework publishes none.

**A thing held once is held, not subclassed:**

```ts
class EmployeeTable {
	private readonly view = createLankaCollectionView<IEmployee, number>({ getValue, getId });

	sorted(rows: readonly IEmployee[], state: ILankaSortState) {
		return this.view.sort(rows, state);
	}
}
```

Composition is the object-oriented idiom, not a workaround for a missing class.
A base class arrives only when subclassing is shown to be what people DO — as it
was for the collection view's ancestor, subclassed by twenty-seven screens.

**`new` never wraps a pure operation.** A class whose every member is static is a
namespace in a class's clothes (`skills/forms/SKILL.md` §1). The object-oriented
form of a stateless operation is a member on a namespace — which is what `Math`,
`JSON` and `Reflect` are in the language, and what the import above gives.

---

## 5. A project pins the style per layer

Applications choose a style per layer and hold it. The framework does not choose
for them, and it does not leave a team arguing in review either:

```js
// eslint.config.js — the consumer's
"lanka/layer-style": ["error", {
	gateway: "class",
	viewmodel: "functional",
	scenario: "both",
}]
```

The rule ships switched on in `lankaBoundaries` and SILENT: an unlisted role is
`both`, and with nothing pinned it reports nothing at all. A framework that fails
a project on upgrade for a decision that project never made has taken the choice
away rather than offered it.

The keys are the roles that have a named pair: `gateway`, `viewmodel`,
`scenario`, `shared-store`, `singleton`, `sse-bridge`, `request`. A plugin and a
bootstrap step are absent, and the reason is worth stating rather than hiding:
their functional style is an object literal satisfying `ILankaPlugin` /
`ILankaBootstrapStep`, and recognising one without type information means guessing
from property names. A rule that guesses reports a style nobody chose.

A project's OWN roles are configured the same way, by naming the pair:

```js
"lanka/layer-style": ["error", {
	roles: {
		repository: { base: "ARepository", factory: "createRepository", style: "functional" },
		command: { construct: "GapCommand", factory: "createGapCommand", style: "functional" },
	},
}]
```

`base` for a role that is EXTENDED, `construct` for one that is only ever built —
a request kind is the framework's own example of the second.

The rule reads the construction form — `extends ALankaX` and `new LankaX` against
`createLankaX(` — and reports the one the project excluded. It never reports a
style the framework dislikes: the framework has no opinion here, and a rule that
carried one would be a design decision smuggled into a linter.

## 6. What the machine checks

`scripts/check-parity.mjs`, over the declared roles and over every pair it finds
in the barrels:

| Tag                      | Fails when                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `role-without-pair`      | a role has a base and no factory, or the reverse                                   |
| `hooks-diverged`         | a field of the context is not a `protected` member of the base under the same name |
| `factory-not-over-base`  | a factory does not go through `defineLankaRole` or its own base                    |
| `context-escapes`        | a base PUBLISHES its style context, putting the extension surface on every object  |
| `style-not-demonstrated` | a playground does not build the role in BOTH styles                                |
| `pair-not-demonstrated`  | a published class and its factory or instance are not BOTH driven by a scene       |

Nine roles, two of them declared apart. A plugin and a bootstrap step are reached
functionally through an INTERFACE — the object the framework already takes — so
their pair is base plus contract, and what is checked is that a scene writes the
CLASS: the object form is exercised by everything the framework does, the class
form by nothing unless something writes one.

The last two are the cheapest and the strongest: a scene runs both styles and
asserts the same result, so behaviour present in one and missing in the other
fails a test rather than a review. The final one is not declared anywhere — the
pairs are read off the barrels, so a class published beside its factory or its
ready-made instance is covered the day it is published rather than the day
somebody remembers to list it.

---

## 7. Adding and changing a capability

| Move                         | Class style                                                 | Functional style                     | Safe?                     |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------ | ------------------------- |
| Add a hook with a default    | a `protected` method with a body, added to `toStyleContext` | an OPTIONAL config field             | yes                       |
| Add a hook without a default | `protected abstract` — every subclass breaks                | a REQUIRED field — every call breaks | **no**: give it a default |
| Rename a hook                | the old member delegates                                    | the old field is still read          | yes, and forever          |
| Widen what a hook receives   | a field on the context object                               | the same object                      | yes                       |
| Add a role                   | base + factory + `toStyleContext` + both scenes             | the same commit                      | —                         |
| Remove anything              | never                                                       | never                                | —                         |

**A capability lands in both styles in one commit.** A lagging factory is how
React's class API died: not by a decision, by a backlog.

---

## 8. Anti-patterns

| Pattern                                                                   | Why it fails                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Writing a factory by hand beside its class                                | the two drift, and a consumer finds out first              |
| A hand-written namespace object                                           | `import * as` reads the same and keeps tree-shaking        |
| A hook named `onX` in one style and `handleX` in the other                | the framework is learned twice                             |
| Passing `this` into a functional hook                                     | the functional style exists to have no `this`              |
| Branching on `instanceof` inside the framework                            | only one style has a prototype; the check breaks the other |
| A style policy shipped by the framework rather than chosen by the project | that is a design decision smuggled into a linter           |
| "The class style is legacy"                                               | the moment that is true, one style is a trap               |
