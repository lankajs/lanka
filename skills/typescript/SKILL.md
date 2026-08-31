# TypeScript

The language settings this repository actually runs under, and what each forbids.
Naming belongs to `skills/naming/SKILL.md`; this is about the language.

## 1. One program, strict, erasable

`tsconfig.base.json` — every package extends it and adds only `include`:

| Option | What it means for you |
| --- | --- |
| `strict` | no implicit `any`, null is a case you handle |
| `noUnusedLocals` / `noUnusedParameters` | an unused binding is an error; prefix `_` to keep one deliberately |
| `erasableSyntaxOnly` | **no parameter properties, no enums, no namespaces** — types may not emit code |
| `noFallthroughCasesInSwitch` | a `case` falls through only with a `break` above it |
| `noUncheckedSideEffectImports` | `import "./x"` must resolve |
| `useDefineForClassFields` | a field initialiser runs at construction, before the constructor body |
| `useUnknownInCatchVariables: false` | `catch (error)` is `any`; narrow it yourself, and this repository does |

`erasableSyntaxOnly` is the one that changes how you write classes:

```ts
// Refused — a parameter property emits an assignment.
public constructor(private readonly store: Store) {}

// The shape this repository uses.
private readonly store: Store;

public constructor(store: Store) {
	this.store = store;
}
```

The gain is that every `.ts` file is valid JavaScript with the types stripped, so
tooling that only strips types — node's own loader among them — runs it.

## 2. `import type`, and why the direction matters

A value import is a DEPENDENCY: it survives into the bundle and belongs in the
package's `dependencies`. A type import disappears.

```ts
import { ALankaGateway } from "…";        // value: the package now depends on it
import type { ILankaTransport } from "…"; // type: nothing at runtime
```

`verbatimModuleSyntax` is off, so the compiler will elide a type-only import for
you — write `import type` anyway. It is the only marker a reader has, and a bench
importing a helper for a value is what added `@lankajs/tool-testing` to five
packages' `devDependencies`.

## 3. Generics

- One letter is not a name. `TItem`, `TState`, `TGateways` — the `T` prefix is
  what tells a reader this is a parameter and not an imported type
  (`skills/naming`), and a lowercase parameter is how `TGateways` once read as a
  value standing where a type belongs.
- Constrain what you use: `TItem extends object` when you spread it, plain `TItem`
  when you only move it around.
- **A type parameter in a method's parameter position makes the class invariant in
  it.** `toStyleContext(): ILankaGatewayContext<TOptions>` on `ALankaGateway` made
  every `ALankaGateway<unknown>` in the locator stop accepting a gateway typed for
  `RequestInit`. The bridge lives in the factory's module for that reason —
  `skills/parity/SKILL.md` §3b.

## 4. `unknown` over `any`, and the cast that says why

`any` disables the checker silently; `unknown` forces the narrowing to be written
where a reader can see it.

```ts
if (typeof value === "number") …
if (value instanceof Date) …
if (isRecord(value)) …            // core's own guard, published as lanka/internal
```

A cast is allowed where the type system genuinely cannot follow — a proxy that
answers a mapped type, a factory that hands back a class typed as its instance —
and it carries a comment saying what the compiler cannot see. `as unknown as X`
without that comment is a defect waiting for a rename.

## 5. Types are declarations, and declarations have a home

- `_types/` and `_interfaces/` hold what more than one file owns; a type with one
  owner lives in that file (`skills/structure` rules 1 and 5).
- An exported type nothing in its file references is an orphan and fails
  `check-structure`.
- `I` for an interface, `T` for a type alias, `A` for an abstract class —
  enforced by `check-naming`, and `A` also means "a subclass may see the
  `protected` members", which `check-structure` enforces the other way round.

## 6. Enums, unions and tables

No enums — `erasableSyntaxOnly` refuses them, and they were not wanted anyway. A
closed set is a union plus, where a value is needed at runtime, a frozen table:

```ts
export const LANKA_KINDS = { list: "list", detail: "detail" } as const;
export type TLankaKind = (typeof LANKA_KINDS)[keyof typeof LANKA_KINDS];
```

`as const` for the values, the type derived FROM them, and the table frozen if it
is published (`skills/forms/SKILL.md` §4). Branching on such a value is a
`Record<TLankaKind, …>` lookup rather than a `switch`
(`skills/composition/SKILL.md`).

## 7. What the compiler cannot check, and eslint does

- **Nothing in the framework imports from the consuming application.** `@App/*`,
  `@Core/*`, `@Gateways/*`, `@Modules/*`, `@Scenarios/*`, `@ViewModels/*` are
  refused by `no-restricted-imports`. The only permitted direction is
  `@lanka_di/*` — the barrels a consumer publishes TO the framework.
- **Core depends on neither a module nor a plugin.** Its tests, benches and
  playground are excepted, and nothing under `core/src` is.
- **A plugin does not import another plugin.** Two plugins that need one thing
  need it in core, behind an extension point.

Run `pnpm run lint` before believing a change; `--max-warnings=0`, so a warning is
a failure here.
