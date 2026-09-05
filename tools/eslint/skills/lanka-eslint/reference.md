<!-- Generated from tools/eslint/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/tool-eslint@1.1.0`** — this document describes that version.
>
> Install: `npm install @lankajs/tool-eslint eslint` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [tools/eslint/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/tools/eslint/_playground/playground.test.ts)

# @lankajs/tool-eslint — user guide

Six ESLint rules that check the boundaries the framework is built on — imports
going one way, gateways reached only from ViewModels, ViewModels never wired to
each other — plus one that pins which of the two writing styles your project
uses.

## You will learn

- the six boundaries, and the defect each one prevents
- how to adapt every rule to a different folder tree
- how to pin one writing style across a project

## When to reach for this

Install it on day one if the boundaries matter to you, and configure its paths
rather than switching a rule off. A project that keeps its own architecture can
skip it entirely — the framework works the same.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install -D @lankajs/tool-eslint
```

```js
// eslint.config.js
import { lankaBoundaries } from "@lankajs/tool-eslint";

export default [lankaBoundaries];
```

That turns all six on as errors. Everything below is about configuring them for
your tree.

## Why these are rules and not tests

A framework whose main promise — _imports go one way_ — is verified by a copy of
a script inside each consumer does not verify it at all, and the third consumer
gets nothing.

## The rules

### `lanka/no-upward-imports`

Nothing below the top layer may reach into it.

```js
rules: { "lanka/no-upward-imports": ["error", { topLayers: ["Modules", "App"] }] }
```

`Core` is what everything depends on. A single `Core → Modules` import makes
_every_ consumer of `Core`, other modules included, depend on one specific
module — after which that module can no longer be reasoned about, tested or
deleted on its own.

### `lanka/gateways-only-in-viewmodels`

```js
rules: {
    "lanka/gateways-only-in-viewmodels": ["error", {
        gatewayImport: "@Gateways/",
        allowedIn: ["ViewModels"],
    }],
}
```

A gateway is the only place with I/O. A component reaching one directly takes on
what a ViewModel **is**: loading state, failure handling, cancellation on leaving
the screen. None of the three appears in the component — they simply vanish, and
it is invisible while the network is fast.

### `lanka/no-gateway-to-gateway`

A gateway is one endpoint's worth of I/O and nothing else. The moment one calls
another, a request chain exists that no screen owns: no loading state belongs to
it, no failure has a place to be shown, and cancelling the screen cancels the
first call while the second is already on the wire.

The composition belongs one layer up — a ViewModel calls two gateways, and the
order, the failure and the cancellation are visible there.

It does **not** forbid sharing a transport, a request class or a base gateway.
Those are not one gateway reaching another; they are the layer below both.

### `lanka/no-viewmodel-to-viewmodel`

A ViewModel owns state. Two of them wired directly own it together: whichever
writes last wins, the second re-renders for reasons its own screen cannot
explain, and neither can be reset without thinking about the other.

The rule can be this blunt because nothing is taken away — the framework already
has a name for the connection. The ladder:

1. one owner ViewModel;
2. a **scenario** when another must react to a fact;
3. a **shared store** only when several must co-edit one state and scenarios have
   turned into synchronisation.

### `lanka/di-barrels-are-framework-only`

Only the framework reads `@lanka_di/*`. The barrels are a contract: you write
them, the framework reads them. It is the only permitted dependency inversion,
and it holds _because there is exactly one reading side_.

Once your application imports its own barrels, it has a second route to its own
scenarios and gateways — one the framework cannot see, cannot substitute in a
test and cannot dispose with the instance.

The vite plugin sets the alias in your config, so the import technically resolves
from anywhere. The invariant currently holds by itself, which is exactly why it
is worth pinning: an invariant that holds by itself stops holding silently.

### `lanka/layer-style`

The framework ships every role in two styles. This rule pins the one your project
writes.

```js
rules: {
    "lanka/layer-style": ["error", {
        viewmodel: "functional",
        gateway: "class",
        scenario: "functional",
        // singleton, shared-store, stream-bridge, request: "both" by default
    }],
}
```

`"class"` · `"functional"` · `"both"` (the default — nothing is reported).

Roles it knows: `gateway`, `viewmodel`, `scenario`, `shared-store`, `singleton`,
`stream-bridge`, `graphql-gateway`, `grpc-gateway`, `request`.

Pin a role of your own the same way:

```js
roles: {
    repository: { base: "ARepository", factory: "createRepository", style: "class" },
}
```

**Plugins and bootstrap steps are absent on purpose.** Their functional style is
an object literal satisfying an interface, and recognising one without type
information means guessing from property names — and a rule that guesses reports
a style nobody chose. Declare them under `roles` with a factory of your own if
you want them pinned.

## Adapting to your tree

Every path in these rules is a **setting**, and the defaults describe the tree
these applications use — `Modules`, `App`, `ViewModels`, `@Gateways/…`. A
different tree **configures** the rules; it does not switch them off.

```js
import { lankaEslintPlugin } from "@lankajs/tool-eslint";

export default [
	{
		plugins: { lanka: lankaEslintPlugin },
		rules: {
			"lanka/no-upward-imports": ["error", { topLayers: ["features", "app"] }],
			"lanka/gateways-only-in-viewmodels": [
				"error",
				{
					gatewayImport: "@/api/",
					allowedIn: ["models"],
				},
			],
		},
	},
];
```

Individual rules are exported too, if you assemble configs yourself:
`lankaNoUpwardImports`, `lankaGatewaysOnlyInViewModels`,
`lankaDiBarrelsAreFrameworkOnly`, `lankaNoGatewayToGateway`, `lankaLayerStyle`,
`lankaNoViewModelToViewModel`.

## Common mistakes

**Disabling a rule instead of configuring its paths.** Every one of them takes
the folder names as options for exactly this reason.

**Reaching a gateway from a component "just for this one screen".** That screen
now has no loading state and no cancellation, and it will look fine until the
network is slow.

**Wiring two ViewModels because a scenario feels like ceremony.** The ceremony is
the part that makes the connection visible and resettable.

## Recap

- Every folder name in these rules is a **setting**; a different tree configures them.
- A gateway in a component silently takes on loading, failure and cancellation — and owns none.
- Two ViewModels wired directly own one state: last write wins.
- `layer-style` is off by default (`both`); pin a style when your project has one.
- Plugins and bootstrap steps are absent on purpose — recognising them would mean guessing.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/tools/eslint/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/tools/eslint/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
