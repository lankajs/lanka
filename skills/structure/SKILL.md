# Structure

What goes in a file, what goes in a folder, and where a test lives.

Enforced by `scripts/check-structure.mjs`, part of `pnpm check`.

`skills/naming/SKILL.md` owns what things are CALLED. This skill owns how many of
them share a file and which folder that file sits in. A question about a name
goes there; a question about placement goes here.

## The six rules

1. **One runtime export per file.** Types describing that export travel with it.
2. **A barrel re-exports and declares nothing.**
3. **A tested unit lives in its own folder with its test.**
4. **An untested file groups by subject.**
5. **A grouping bucket carries a leading underscore, and only a bucket does** —
   and `_factories/` holds the factories the package exports, while the ones it
   does not are `_internal/`.
6. **Every package has a `_playground/`** — the package used as a consumer uses it,
   laid out by rules 1–5 like the application it imitates.

7. **A `protected` member is an inheritance contract** — only an `A`-prefixed
   base may declare one.

Everything below is those seven rules against every case that occurs.

---

## 1. One runtime export per file

A **runtime export** is an exported `class`, `function`, `const`, `let` or `var` —
anything that exists after the type layer is erased. A file exports **at most
one**.

A **type export** is an exported `interface` or `type`. A file may export as many
as it needs, subject to rule 1b.

The line sits where the language already draws one. A runtime export is an
identity a consumer imports, mocks and reasons about; a type is erased at build
and costs nothing to keep beside the thing it describes.

### 1a. What may share the file with the runtime export

| May share                                | May not share                              |
| ---------------------------------------- | ------------------------------------------ |
| the export's config / options interface  | a second exported class, function or const |
| the export's return or result type       | a type with another owner (see 1b)         |
| callback and hook types in its signature | a re-export of something else              |
| its diagnostics / snapshot shapes        | anything the export does not reference     |
| module-private helpers (not exported)    |                                            |

A type "belongs to" the runtime export when the export's own signature names it,
directly or through another type in the same file. A type nothing in the file
references is a type with no owner here.

```ts
// createLankaLatestGuard.ts — correct
export interface ILankaLatestGuard { … }        // the return type
export type TLankaLatestToken = …               // named by ILankaLatestGuard
export const createLankaLatestGuard = …         // THE one runtime export
```

### 1b. When a type moves out

A type with **two or more owners** in different files gets its own file, named
after itself, in the nearest `_interfaces/` or `_types/` bucket shared by its
owners (rule 5).

One owner plus its own tests is still one owner. A type re-exported by a barrel
is still one owner: a barrel is not an owner.

```
core/src/scenario/
  _interfaces/ILankaEventMetadata.ts    ← read by the bus, the scenario and the log
  event-bus/lanka-event-bus/lankaEventBus.ts
```

### 1c. The decision table

| The file holds                                                     | Do this                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1 runtime export + its own types                                   | Nothing. This is the target shape.                                   |
| 1 runtime export + a foreign type                                  | Move the type out per 1b.                                            |
| 2 runtime exports, one a predicate over the other's class          | Fold the predicate into a static: `LankaError.is(x)`.                |
| 2 runtime exports, one a factory and the other its applied result  | Keep, and list the file in `ONE_SUBJECT` (shape C).                  |
| 2 runtime exports forming a symmetric pair over one representation | Keep, and list the file in `ONE_SUBJECT` (shape A).                  |
| 2 runtime exports, one used only by the other                      | Make the used one module-private (drop `export`).                    |
| Module state declared here, plus what writes and reads it          | Keep, and list the file in `ONE_SUBJECT` (shape B).                  |
| A class and its single module-level instance                       | Keep. Shape D — checked by name, no list.                            |
| 2+ unrelated runtime exports                                       | Split. One file each, in a folder named for the subject they shared. |
| Only types                                                         | Fine — a type file has no runtime export to be single.               |
| Only constants, all of one subject                                 | One `const` object, or split. Never a loose bag.                     |

### 1d. The `ONE_SUBJECT` list

Four shapes are allowed to keep several runtime exports. Three are named in
`ONE_SUBJECT` in `scripts/check-structure.mjs` with the shape recorded; the
fourth is recognised by the checker itself:

**A. A symmetric pair over one representation** — `stringToBigInt` /
`bigIntToString`, `createObjectUrlSafely` / `revokeObjectUrlSafely`. Splitting
them means reading two files to see one format, and the two halves can then
disagree about it.

**B. Module state declared in this file, with what writes and reads it** —
`setActiveRuntime` / `getActiveRuntime` / `requireActiveRuntime` over the active
runtime slot; `setLankaStorageSecret` and the store that requires the secret. The
STATE is the subject. The state must be declared in this file: an accessor
importing someone else's `let` is not this shape, it is a second owner.

**C. A factory and its applied result** — `createInFlightCounter` and the
`lankaHttpInFlight` it produces. The const IS the factory call; a consumer uses
the const, and the factory exists so a test or a second instance can have its
own. Splitting them puts the default a file away from what makes it.

**D. A class and the single instance of it** — `PlaygroundTodoCompleted` and
`playgroundTodoCompleted`. This one needs no list entry: the relationship is
machine-visible, because the const is `new Class()` and carries the class's own
name with a lower-case first letter. Splitting it is not merely undesirable but
impossible — the two file names would differ only in their first letter, and a
case-insensitive filesystem cannot hold both.

The list is deliberately short and grows only with the shape recorded beside the
entry. "It felt related" is none of the four. A checker rule anyone may opt out
of is a rule that reports success.

### 1e. Worked cases

**Basic — a factory and its config.** Already correct, no move.

```ts
// timeoutMiddleware.ts
export interface ILankaHttpTimeoutConfig { … }
export const createTimeoutMiddleware = (config: ILankaHttpTimeoutConfig) => …
```

**Basic — a class and a predicate over it.** Two runtime exports; the predicate
becomes a static.

```ts
// before — LankaError.ts
export class LankaError extends Error { … }
export function isLankaError(value: unknown): value is LankaError { … }

// after — LankaError.ts
export class LankaError extends Error {
	static is(value: unknown): value is LankaError { … }
}
```

**Complex — a class with six of its own shapes.** One runtime export; every
interface is named by the class's own signature. Correct as it stands, and
splitting it would put a diagnostics shape a file away from the only method that
returns it.

```ts
// LankaChunkPreload.ts
export interface ILankaChunkEntry { … }
export interface ILankaIdleScheduler { … }
export interface ILankaNetworkConditions { … }
export interface ILankaVisibilityConditions { … }
export interface ILankaChunkPreloadConfig { … }
export interface ILankaChunkPreloadDiagnostics { … }
export class LankaChunkPreload { … }
```

**Complex — five unrelated extractors.** Five runtime exports, no shared
representation, no symmetry. Splits into five files under the subject folder they
already shared.

```
before: plugins/http/src/errors/extractors.ts
after:  plugins/http/src/errors/lanka-code-from-error-code/lankaCodeFromErrorCode.ts
        plugins/http/src/errors/lanka-message-from-field-errors/lankaMessageFromFieldErrors.ts
        …
```

**Complex — a bootstrap entry with five interfaces and two functions.**
`createLanka` and `resetActiveLanka` are both runtime exports and neither is the
other's factory result. `resetActiveLanka` moves out; the five interfaces stay
with `createLanka`, whose signature names all of them.

---

## 2. A barrel re-exports and declares nothing

`index.ts` at any level exports names from elsewhere. It declares no class, no
function, no const, no interface, no type — and no module-private helper either.

A barrel is the answer to "what does this package expose?", and it is only a
cheap answer while it can be read without reading code. A barrel that also
implements makes its own surface the one thing you cannot see at a glance.

```ts
// plugins/http/src/index.ts — correct
export { lankaHttp } from "./lanka-http/lankaHttp";
export type { ILankaHttpConfig } from "./config/lankaHttpConfig";
```

The docblock at the top of a barrel is not an exception: prose is not a
declaration. A barrel's docblock is the right place for what the subsystem is
FOR, since it is the file a reader opens first.

**When a barrel currently implements**, the implementation moves to a file named
after the export, in a folder named after it, beside the barrel:

```
before: plugins/sse/src/index.ts        (lankaSse + 2 interfaces)
after:  plugins/sse/src/index.ts        (re-exports only)
        plugins/sse/src/lanka-sse/lankaSse.ts
```

---

## 3. A tested unit lives in its own folder with its test

**Every file that HAS a test lives in its own folder together with that test.**
A tested unit is never a flat sibling of another tested unit.

Navigation is the whole reason. In a flat directory of nine files, which four
have tests is a question you answer by reading the listing; with a folder per
unit it is the shape of the tree.

### 3a. Mechanics

| Question                         | Answer                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Folder name                      | kebab-case of the file's base name: `createLankaVM.ts` → `create-lanka-vm/`                                   |
| A type marker in the name        | Dropped: `ALankaGateway.ts` → `lanka-gateway/`, not `alanka-gateway/`                                         |
| A run of capitals                | Splits before the last one: `LankaScenarioVMRegistry` → `lanka-scenario-vm-registry/`                         |
| File name inside                 | unchanged — `create-lanka-vm/createLankaVM.ts`                                                                |
| Already `x/X.ts`?                | Correct. Do NOT nest into `x/x/X.ts`.                                                                         |
| A folder left holding one folder | Collapse it. See 3e.                                                                                          |
| Split tests of one unit          | Move with it: `createLankaVM.test.ts` and `createLankaVM.blindSpot.test.tsx` both live in `create-lanka-vm/`. |
| Two units, one shared test       | Split the test per unit, or delete it if per-unit tests already cover it.                                     |
| A tested type-only file          | Yes, it gets a folder too. Testing is what triggers the rule, not what the file contains.                     |
| An untested file                 | No folder. Rule 4 applies instead.                                                                            |

### 3b. One unit, one test set

A test file asserts one unit. A test over several units is split into that many,
one per unit's folder — or deleted, when per-unit tests already say the same
thing.

Splitting a unit's own tests by concern is encouraged and does not create a
second unit: `lankaEventBus.test.ts`, `lankaEventBus.unsubscribe.test.ts` and
`lankaEventBus.replayAndLifecycle.test.ts` are one unit in one folder.

### 3c. Cross-cutting tests are exempt

A test asserting a **repo-wide or package-wide invariant across many units** has
no single owner and stays at the level it speaks for — the package `src/` root or
the subsystem folder:

- public-surface and brand assertions (`publicSurface.test.ts`, `brand.test.ts`)
- contract tests over a family of implementations (`locator.contract.test.ts`)
- wiring and drift guards that read source rather than call it

These are named in `CROSS_CUTTING` in the checker. The test is that it asserts
something **no single unit can be responsible for**. A test that merely covers
two units is not cross-cutting — it is a test that needs splitting.

### 3d. Moving a unit into a folder

The move is one level deep, so every relative path in the moved file loses a
level and every importer gains a segment:

1. `git mv` the unit and all its tests into `<kebab-name>/`.
2. In the moved file: `../x` → `../../x`; `./sibling-that-stayed` → `../sibling-that-stayed`.
3. In every importer: `./x` → `./<kebab-name>/x`.
4. `tsc -b` until clean, then the test run, then lint.

**The paths `tsc` does not check are where this breaks.** Aliases in a vitest
config, fixture paths, glob patterns in a build config and any path inside a
string literal all survive a green typecheck and fail at run time. Grep the moved
base name across configs before declaring the move done — a scaffolder's stub is
the trap: `from "../src/…"` inside a template is text written INTO a consumer,
where the depth is theirs and must not follow yours.

### 3e. A folder holding one folder collapses

Once a unit moves into its own folder, the folder that held it may be left with
nothing else. It then names a subject the inner folder already names, and only
adds a level: `plugins/http/src/auth/auth-middleware/` is
`plugins/http/src/auth-middleware/` with a step in the middle.

Collapse it. The rule is about what is THERE, not about what might arrive: a
grouping folder earns its level when a second thing joins it, and re-creating it
then is one move.

---

## 4. An untested file groups by subject

A file with no test does not get a folder of its own. It sits in the folder of the
subject it belongs to, beside its siblings:

```
core/src/scenario/
  _interfaces/ILankaEventLog.ts
  _interfaces/ILankaEventMetadata.ts
  _types/TLankaEventBusMiddleware.ts
```

`_interfaces/` and `_types/` group declarations that have no runtime identity to
name a subject after. They never hold a runtime export — a folder holding one is
a subject folder and is named after the subject.

---

## 5. A bucket carries an underscore, and only a bucket does

Two kinds of folder exist, and a path should say which one you are looking at.

A **subject folder** names the THING: `gateway/`, `event-bus/`, `polling/`,
`lanka-fetch-request/`. Its name is the answer to "what is this".

A **bucket** names the KIND of what it holds and nothing else: `_types/`,
`_interfaces/`, `_factories/`. Its name is the answer to "what sort of things are
in here", and the things inside carry the subjects.

The underscore marks the second kind. Without it a reader scanning
`gateway/request/transport/types/` cannot tell which segments are the design and
which are filing.

### 5a. The bucket names

| Bucket           | Holds                                                           |
| ---------------- | --------------------------------------------------------------- |
| `_abstractions/` | the abstract bases a consumer extends                           |
| `_factories/`    | every `create…` that builds one of something                    |
| `_facades/`      | modules that only delegate: the ambient proxies                 |
| `_utils/`        | pure functions over plain values, using no word from the domain |
| `_types/`        | type aliases with more than one owner                           |
| `_interfaces/`   | interfaces with more than one owner                             |
| `_guards/`       | type guards                                                     |
| `_registries/`   | registries of one family                                        |
| `_adapters/`     | implementations of one port                                     |
| `_rules/`        | lint rules                                                      |
| `_internal/`     | what the package does not export                                |
| `_testing/`      | test doubles and harnesses                                      |
| `_fixtures/`     | committed fixture data                                          |
| `_playground/`   | the miniature application of rule 6                             |

The list is closed. Adding to it means the name has a real EDGE: "interface" and
"type" are syntactic categories, "adapter" and "rule" are roles the code states.
A name whose membership is a matter of opinion is not a kind.

### 5a-i. What is left at the root

**The domain.** A subsystem's root holds the classes and functions an application
would recognise by name — `LankaFetchJsonRequest`, `LankaScenarioBootstrap`,
`compareLankaValues`, `nextLankaSortState` — and nothing that is a KIND. Reading
`core/src/gateway/` should answer "what does this subsystem do", not "what sorts
of file are here".

The four buckets above the line are the ones that make that true, and each has an
edge sharp enough to check:

- an **abstraction** declares `export abstract class A…`;
- a **factory** is named `create…` and answers something built;
- a **facade** holds no logic: every member forwards to something else, which is
  what the four locator proxies and the event bus do;
- a **utility** is a pure function over plain values, named after what it does to
  them, using no word from the domain. `haveSameOrder` is one; `compareLankaValues`
  is not, because ordering rules are what a collection package is ABOUT.

`check-structure` enforces the first two by name — an `A*` base or a `create*`
file outside its bucket fails — and a file already inside any bucket is left
alone, because `_internal/create-…` is internal first and a bucket inside a
bucket says nothing.

### 5a-ii. `_factories/` is what a consumer calls

A factory the package does not export is machinery, and it belongs in
`_internal/` — which is defined as exactly that. Both are `create…`, so 5a-i puts
them in one bucket, and `viewmodel/_factories/` reached eleven folders where
seven were the calls an application makes and four were the pieces those calls
are built out of. Opening the bucket answered "what sorts of file are here"
again.

The split is NOT by audience. "What a user normally reaches for" is a matter of
opinion, and 5a refuses a bucket whose membership is one. It is the edge
`skills/surface/SKILL.md` already draws and `api/` already records: exported, or
not. `check-structure` reads the surface through `check-api.mjs` — not through
`api/*.api.md`, because a gate trusting a generated file goes quiet the moment
somebody forgets to regenerate it — and reports `[factory-not-published]`.

A `create…` already inside `_internal/` is left alone, by 5a-i's rule that a
bucket inside a bucket says nothing.

### 5b. What the underscore does NOT do

It does not rescue a name that has no subject. `helpers`, `common`, `shared`,
`misc`, `lib` and `constants` are refused by `skills/naming/SKILL.md` **with or
without** the marker: `_helpers/` is `helpers/` with a sticker on it. "Helper" has
no edge — every function is somebody's helper — so the folder still collects
whatever has no home.

`utils` used to be on that list and came off it, which is the exception that
shows what the rule is really about. It was refused because nobody could say what
belonged there; it is admitted now because the sentence above says exactly what
does — a pure function over plain values, using no word from the domain — and a
sentence like that is what turns a name into a kind.

When rule 1 tells you to split something out, the destination is a folder named
for what the thing IS.

### 5c. A package is not a bucket

`tools/testing/` is a published package whose subject happens to be testing;
`modules/blob-cache/src/_testing/` is a bucket of doubles inside one. The
distinction is position: a directory directly under `tools/`, `modules/` or
`plugins/` is a package and keeps its bare name.

---

## 6. Every package has a `_playground/`

A miniature application that uses the package **the way a consumer does** —
through its public surface, end to end — plus the tests that drive it.

A unit test proves a part behaves. A playground proves the parts still FIT, and
that is a different failure: every unit green while the package is broken is
exactly what a refactor produces.

### 6a. What is in it

| Path                    | Holds                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `app.ts` / `app.tsx`    | the ENTRY POINT: re-exports only, the one path a test starts from |
| `playground.test.ts(x)` | scenes driving that application from the outside                  |
| everything else         | the application itself, laid out by rules 1–5                     |

The application is a real one for its size: it wires the package the way an
adopter would, names things the way a product does, and stubs **only** the
outside world. A playground that stubs the layer under test proves the stub
works.

React where the package's subject is rendering; plain TypeScript everywhere
else. A module that never touches a DOM gets no React, and the playground is
the place that makes that visible.

**`app.ts` is a barrel, and rule 2 applies to it in full.** Every part of the
miniature application lives in its own file under `_playground/` — a gateway
folder, a scenario folder, a view model folder, a screen folder, an entry point,
stubs under `_testing/`, shapes under `_interfaces/`. All sixteen playgrounds
here were one file each once, and that is the shape a playground exists to argue
AGAINST: it stops being an example of how the framework is meant to be used the
moment it grows, because nobody writes an application that way.

Rules 3–5 apply unchanged, the wrapper rule included: a `scenarios/` folder with
one scenario in it is a level that names what its child already names.

### 6b. It is linted and type-checked like everything else

Each package's `tsconfig.json` includes `_playground/**/*` and its `lint` script
covers `_playground`, both written by the scaffolder so no package can be
missed.

Neither is a formality. A playground outside the program keeps compiling against
a signature the package no longer has, and an example that breaks the rules the
package publishes teaches them wrong faster than the README teaches them right.
Turning linting on found both of those the same afternoon: a core playground
reaching for the test kit, and a `Request` stringified to `[object Object]` so
every assertion about which URL was fetched passed against the same wrong
answer.

### 6c. What it is FOR

- **Regressions.** A failure that needs the whole chain has no single unit to
  live in. Reproduce it here first, then fix it.
- **Adding functionality.** A new capability gets a scene, not only a unit test.
  A capability nothing in the playground uses is a capability no consumer has
  been shown how to use.
- **Reading.** It is the shortest honest answer to "what does this package
  actually do", and unlike a README it cannot go stale: it is executed.

### 6d. Why `_playground` and not something else

`playground/` is the name the ecosystem already uses for exactly this — a small
app kept in-repo to exercise a library. `examples/` is a shop window for
consumers and drifts because nothing runs it; `e2e/` and `integration/` name a
kind of TEST, and this is an application that happens to be tested. The
underscore is rule 5: it holds a kind, not a subject.

---

## 7. `protected` is a promise, and `A` is where it is made

A `protected` member is visible to every subclass, so it is part of the contract
whether or not anyone wrote it down. The naming canon already separates a base
designed for inheritance — `ALankaGateway`, `ALankaScenario`,
`ALankaTransportRequest` — from a class that merely exists; this rule makes that
prefix mean something.

| Shape                                        | `protected` allowed | Why                                                                                  |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `export abstract class ALankaThing`          | yes                 | designed for inheritance, and the header says what a subclass must implement         |
| `export class LankaThing extends ALankaBase` | yes                 | an override keeps a visibility the base already promised; it is not a second promise |
| `export class LankaThing`                    | **no**              | the fragile base class: nobody decided, and a consumer finds out in a minor          |

The two honest fixes for the third row are named in the failure: make the class
abstract and `A`-prefixed and state its contract, or make the member `private`.

Both fixes were real when the rule landed. `LankaCookies` and
`LankaEncryptedStorage` had `protected constructor() {}` meaning "static only" —
which reads as an invitation to subclass and promises a contract nobody wrote;
both became `private`. `LankaStorage` is the exception the ratchet carries: it is
the static API an application calls AND the base `LankaEncryptedStorage` extends,
and separating those two is a refactor rather than a rename.

The publishing half of this — which tier a base belongs to, and what a version
may do to it — is `skills/surface/SKILL.md` §3.

---

## 8. Test-support files

A kit imported as a whole — fake adapters, builders, clocks, response factories —
is exempt from rule 1. It is read as one thing and imported as one thing, and
splitting fifteen doubles into fifteen files adds fifteen import lines to every
test that uses four of them.

The exemption is narrow:

- It applies under a `testing/` folder or to a file whose name ends `TestDoubles`,
  `TestFakes` or `Harness`.
- It does not apply to production code that happens to be used by tests.
- The size ratchet still applies: a kit that grows past its recorded line count
  fails, so the exemption cannot become a dumping ground.

---

## 9. What the machine checks

`scripts/check-structure.mjs`:

| Tag                          | Fails when                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `one-runtime-export`         | A non-barrel file exports 2+ runtime declarations and is not in `ONE_SUBJECT`.                |
| `orphan-type`                | An exported type in a file is referenced by no other declaration in it.                       |
| `barrel-declares`            | An `index.ts` declares anything at all.                                                       |
| `flat-tested-units`          | A directory holds tests for 2+ different units.                                               |
| `orphan-test`                | A test has no sibling source of its name and is not in `CROSS_CUTTING`.                       |
| `wrapper-folder`             | A folder whose only content is one folder — it adds a level and nothing else.                 |
| `bucket-without-underscore`  | A folder named after a KIND without the marker.                                               |
| `underscore-without-bucket`  | A marker on a folder that names a thing.                                                      |
| `inheritance-not-declared`   | A class that is neither `A`-prefixed nor extending an `A` base declares a `protected` member. |
| `kind-outside-its-bucket`    | An `A*` base or a `create*` file sitting at a root instead of its bucket.                     |
| `package-without-playground` | A package with no `_playground/` holding an app and its tests.                                |

Each failure names the file, the rule and the remedy. A bare "violates the
structure" forces reading this whole document for one line.

---

## 10. The shape, end to end

```
plugins/http/src/
  index.ts                                  ← re-exports only
  lanka-http/                               ← subject: the plugin itself
    lankaHttp.ts                            ← 1 runtime export + its config type
    lankaHttp.test.ts
  config/
    lankaUnsafeMethods.ts                   ← untested, groups by subject
  errors/                                   ← subject: failure parsing
    isPlainRecord.ts                        ← untested, module-private to this folder
    lanka-code-from-error-code/
      lankaCodeFromErrorCode.ts
      lankaCodeFromErrorCode.test.ts
    lanka-message-from-detail/
      lankaMessageFromDetail.ts
      lankaMessageFromDetail.test.ts
  _interfaces/                              ← BUCKET: kind, not subject
    ILankaHttpConfig.ts                     ← two owners, so it moved out
```

Read top-down it answers, in order: what the package exposes, what its one entry
does, what is configurable, what the pieces are, which of them are tested, and —
by the underscore alone — which folders are design and which are filing.
