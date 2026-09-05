---
name: lanka-eslint
description: Enforce lanka's architectural boundaries with ESLint — one-way imports, gateways only in ViewModels, no ViewModel wired to another, and a pinned writing style. Use when setting up lint for a lanka app, when a boundary rule fires, when adapting the rules to a different folder tree, or when reviewing `eslint.config.js` in a lanka project.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-eslint
    version: "1.1.0"
---

# @lankajs/tool-eslint

Six rules that check the boundaries the framework is built on. `reference.md`
beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

```js
import { lankaBoundaries } from "@lankajs/tool-eslint";

export default [lankaBoundaries];
```

## The rules, and the defect each prevents

| Rule                                  | Prevents                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `lanka/no-upward-imports`             | one `Core → Modules` import making every consumer depend on that module         |
| `lanka/gateways-only-in-viewmodels`   | a component silently owning loading, failure and cancellation — and owning none |
| `lanka/no-gateway-to-gateway`         | a request chain no screen owns and no cancellation reaches                      |
| `lanka/no-viewmodel-to-viewmodel`     | two ViewModels owning one state; last write wins, neither resets alone          |
| `lanka/di-barrels-are-framework-only` | a second route to your own scenarios that the framework cannot see              |
| `lanka/layer-style`                   | half the project written as classes and half as factories                       |

## Adapt the paths — never switch a rule off

Every folder name is a **setting** whose default describes one tree:

```js
{
  plugins: { lanka: lankaEslintPlugin },
  rules: {
    "lanka/no-upward-imports": ["error", { topLayers: ["features", "app"] }],
    "lanka/gateways-only-in-viewmodels": ["error", { gatewayImport: "@/api/", allowedIn: ["models"] }],
  },
}
```

## Pinning a style

```js
"lanka/layer-style": ["error", {
  viewmodel: "functional",
  gateway: "class",
  roles: { repository: { base: "ARepository", factory: "createRepository", style: "class" } },
}]
```

`"class"` · `"functional"` · `"both"` (default, silent). Known roles: `gateway`,
`viewmodel`, `scenario`, `shared-store`, `singleton`, `stream-bridge`,
`graphql-gateway`, `grpc-gateway`, `request`.

Plugins and bootstrap steps are absent on purpose: their functional form is an
object literal, and recognising one without type information means guessing —
a rule that guesses reports a style nobody chose.

## What `no-gateway-to-gateway` does NOT forbid

Sharing a transport, a request class or a base gateway. Those are the layer below
both, not one gateway reaching another.

## When a rule fires, do this instead

| Rule                             | The move                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| gateway imported in a component  | put the call in the screen's ViewModel                        |
| gateway imports a gateway        | compose in the ViewModel, where order and failure are visible |
| ViewModel imports a ViewModel    | a scenario for the fact; a shared store only for co-editing   |
| upward import                    | move the shared thing down, or invert with an interface       |
| `@lanka_di` imported in app code | resolve through the locator instead                           |

## Never do these

- **Never disable a rule instead of configuring its paths.**
- **Never suppress `no-viewmodel-to-viewmodel` "just here".** The ladder is: one
  owner → a scenario → a shared store.
- **Never apply `lankaBoundaries` to the framework repository itself** — the
  `@lanka_di` rule forbids exactly the inversion the framework stands on.

## More

`reference.md` — the full guide, with every option and the reasoning per rule.
