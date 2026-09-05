# Surface

What a consumer may reach, what the framework promises about it, and how any of
it is allowed to change.

`skills/structure/SKILL.md` owns where a file sits. `skills/composition/SKILL.md`
owns what is written in it. This skill owns what leaves the package — and it is
the only one of the three whose mistakes are paid for by somebody else, in their
repository, on an upgrade they did not plan.

## The one rule

**Everything is reachable. Only what is named is promised.**

Two axes, and conflating them is the mistake this skill exists to prevent:

| Axis         | Question                             | Answer here                 |
| ------------ | ------------------------------------ | --------------------------- |
| Reachability | can a consumer import it at all?     | almost always yes           |
| Promise      | will it still be there next release? | only if it is in the facade |

A framework that hides its internals does not stop the person who needs them; it
makes them fork the whole thing. A framework that promises its internals cannot
be changed. Reaching in must be possible and must be **visible in the import
line**, which is the only place a reviewer reliably looks.

## The four rules

1. **Three tiers, and the tier is written in the import path.**
2. **The facade only grows** — which is why entering it is expensive.
3. **`A` is the inheritance contract** — a designed base promises its `protected`
   members; nothing else does.
4. **Change is additive, and deprecation is the failure case** — not the plan.

---

## 1. Three tiers

| Import                                    | Holds                                                                                                                      | Breaks in               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `lanka/<subsystem>`, `@lankajs/<pkg>`       | the **facade**: ports, factories, abstract bases, default implementations, errors, the types they need                     | a major, and see rule 2 |
| `lanka/extend`, `@lankajs/<pkg>/extend`     | **mechanism**: registries, wiring, everything needed to build a devtool, a competing implementation, or a deep integration | a minor, never a patch  |
| `lanka/internal`, `@lankajs/<pkg>/internal` | **primitives**: helpers, the active-instance pointer, small utilities packages share                                       | any release             |

Two extra subpaths per package, not three per subsystem. Thirty barrels would
buy nothing: the facade is already split by subsystem, and mechanism is small
because most of it belongs in the facade the moment somebody has a reason to use
it.

### 1a. Which tier

| The thing is…                                                         | Tier                                |
| --------------------------------------------------------------------- | ----------------------------------- |
| a port a consumer implements (`ILankaTransport`)                      | facade                              |
| a factory a consumer calls (`createLankaVM`)                          | facade                              |
| an abstract base a consumer extends (`ALankaGateway`)                 | facade                              |
| a default implementation the framework picked (`LankaFetchTransport`) | facade — see rule 4 of this section |
| an error, or a type those need                                        | facade                              |
| a registry the framework fills and a devtool reads                    | extend                              |
| the wiring between two subsystems                                     | extend                              |
| a class that exists so the facade has something to construct          | extend                              |
| a pure utility over ordinary values (`generateUuid`)                  | internal                            |
| the active-instance pointer, module state                             | internal                            |

**No private defaults.** If the framework chose an implementation for the
consumer, both the port and the chosen implementation are public. This is what
makes "modify anything" true without a dependency-injection container the size
of the one in Nest: take the default, extend it, hand it back.

### 1b. A tier is not a folder

Tiers are `exports` entries and barrels. `_internal/` on disk is a structure
rule (`skills/structure/SKILL.md`, rule 5) and says nothing about publishing:
a file under `_internal/` may be exported through `lanka/internal`, and a file
outside it may not be exported at all. The two answer different questions.

What is forbidden is the state this repository was in before this skill existed:
a root barrel that said `_internal` may be refactored without a major, and
re-exported three things out of it in the same file.

### 1c. Packages depending on a tier

A sibling package may import `lanka/internal`. They are released together and
`verify-build.mjs` proves the tarballs agree, so a patch-level change there
cannot reach a consumer through the back door — it reaches the sibling first, in
the same commit.

A CONSUMER importing `lanka/internal` is doing something the word in their import
line already told them about. That is the whole mechanism, and it is enough.

---

## 2. The facade only grows

**A name in the facade is not removed.** Not in a minor, and — with the single
exception in §7d — not in a major either. It may be superseded, it may be
discouraged, it keeps working.

That promise is only survivable if admission is deliberate, so the two halves of
this rule hold each other up:

| Because                | Therefore                  |
| ---------------------- | -------------------------- |
| removal is forbidden   | admission is expensive     |
| admission is expensive | removal can stay forbidden |

**Cost of entering the facade** — all three, no exceptions:

1. A scene in the package's `_playground/` that uses it the way a consumer would.
   An export nobody has been shown how to use is a promise made blind.
2. A line in `api/<pkg>.api.md`, the checked-in report. The diff of that file is
   the review of the promise; without it a contract change is invisible in a pull
   request.
3. A shape that can absorb its own future — §6 is that list.

Anything that fails one of the three goes to `extend`. That is not a demotion:
`extend` is where a capability lives while its shape is still being learned, and
graduating is one line in the registry plus the three costs above.

---

## 3. `A` is the inheritance contract

Inheritance makes `protected` members part of the contract. That is why a
framework which invites inheritance needs to say WHERE it invited it.

The naming canon already carries the marker: an abstract base is `A`-prefixed.
This skill makes it a promise.

### 3a. `A*` — designed for inheritance

- `public` **and** `protected` members are the contract of the tier it sits in.
- The class documents, in its own header: what a subclass MUST implement, what it
  MAY override, and what it must not touch.
- A template method holds the order of operations, and the subclass supplies
  steps. `ALankaTransportRequest` is the worked example: it owns
  mock → send → check → parse, and a subclass writes `parse` alone. A subclass
  cannot get the order wrong because it never sees the order.
- Adding an abstract member is a BREAK (every subclass stops compiling). Add a
  member with a default implementation instead.

### 3b. Everything else — extend at your own risk

- Only `public` members are promised. `protected` may change in a minor.
- This is not a prohibition. Subclassing `LankaFetchJsonRequest` is expected and
  supported; the framework simply does not freeze the parts of it that were never
  designed to be seen from below.

### 3c. The check

An exported class that is not `A`-prefixed and declares `protected` members is a
finding. Two honest fixes:

- it is designed for inheritance → it is abstract, `A`-prefixed, and documents
  its contract;
- it is not → the member is `private`.

The third option — a `protected` member on a concrete class, meaning "I did not
decide" — is the fragile base class, and it is discovered by a consumer, in a
minor, as a compile error in code they did not touch.

---

## 4. Extension points are a registry

An extension point is a contract, not a hook (`skills/composition/SKILL.md`, §4).
The list of them is finite, named and machine-checked:

| Point                         | Occupied by                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `useRequestMiddleware`        | `@lankajs/plugin-http` changes the request; `@lankajs/plugin-devtools` only times it              |
| `inFlight`                    | `@lankajs/plugin-prefetch` asks before starting; `@lankajs/plugin-devtools` watches to draw it     |
| `lankaEventBus.addMiddleware` | `@lankajs/plugin-devtools`, to date an event at the moment it is dispatched                      |
| `lankaEventBus.addObserver`   | `@lankajs/plugin-devtools`, for what BECAME of it — the only source of `stoppedBy`                |
| `LankaLogger.addSink`         | `@lankajs/plugin-devtools`, and a consumer's own transport                                       |
| `use(plugin)`                 | every plugin                                                                                   |

The bus has two points rather than one, and the difference is what an occupant is
allowed to DO. A middleware sits in the chain and may stop an event; an observer
is told what became of one and may do nothing at all. The second exists because
the first could not answer its own question: a middleware sees only the chain
ahead of itself, a diagnostic tool's is registered first at bootstrap, and
`stoppedBy` was therefore a documented field that no code path could ever fill.

Two failures the registry closes: a point nobody occupies (an imagined need,
costing real support), and a plugin occupying a point nobody declared (an
undocumented hook that becomes load-bearing). Both are checked by
`scripts/check-extension-points.mjs`, and the occupant list is part of the
DECLARATION rather than derived from the scan — a list derived from what it
measures agrees with itself and checks nothing.

It earned itself immediately: this table said the in-flight counter had one
occupant, and the inspector had been subscribing to it for as long as it has
existed.

A new point is added WITH its first occupant, never before.

---

## 5. What a version means

| Release | Facade         | `extend`   | `internal` |
| ------- | -------------- | ---------- | ---------- |
| patch   | unchanged      | unchanged  | may change |
| minor   | grows only     | may change | may change |
| major   | grows; see §7d | may change | may change |

**The target a consumer should experience: a minor is a version bump, and a major
is a version bump plus a note they read once.** A major exists to change
mechanism, raise a peer range, or change what a default DOES — not to make a
consumer rename things across their repository.

A peer-dependency range widening is a minor. Narrowing one is a major, because it
can make an installed tree invalid.

---

## 6. Changing without breaking

### 6a. The safe moves

| Move                                                       | Why it is safe                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Add a new export                                           | nothing referred to it before                                    |
| Add an **optional** field to an options object             | every existing call still type-checks and still behaves the same |
| Add an overload that accepts strictly more                 | old call sites match the old overload                            |
| Widen a parameter type                                     | every argument that fit still fits                               |
| Add a member to an interface **the framework implements**  | consumers read it; nobody had to write it                        |
| Add a new subpath, a new tier entry, a new package         | additive by construction                                         |
| Add a member with a default implementation to an `A*` base | subclasses that ignore it keep compiling                         |

### 6b. The move that looks safe and is not

**Adding a member to an interface the CONSUMER implements is a break.** A port is
implemented by them: `ILankaTransport`, `ILankaPlugin`, a scenario, a bridge.
Every new required member is a compile error in code they did not touch.

The question is never "is this interface public" but **"who writes the
implementations"**:

- framework implements it → adding is safe;
- consumer implements it → adding requires the member to be optional, with the
  framework supplying the old behaviour when it is absent; or a second port.

A port is therefore kept minimal by construction. It is the one place where
"give people less" is the generous choice.

### 6c. The unsafe moves, and what to do instead

| Wanted                                    | Do this instead                                                   |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Rename `X` to `Y`                         | export both; `Y` is canonical, `X` is an alias that keeps working |
| Remove a parameter                        | make it optional and ignore it                                    |
| Change a return shape                     | a new name with the new shape; the old name keeps the old shape   |
| Reorder positional parameters             | an options object — and see 6d.1 so it never comes up             |
| Remove a union member a consumer may hold | never; add the new member, keep the old one accepted              |
| Turn a class into a factory               | keep the class as a thin subclass over the factory                |
| Move a thing to another package           | re-export it from where it was                                    |
| Make an optional field required           | supply the old default in code; the field stays optional          |

Each of these costs a few lines that live forever. That is the price of the
promise in rule 2, and it is far below the price a consumer pays for a rename
across their repository.

### 6d. Shapes that absorb their own future

These are the rules that keep §7 from ever being needed. They apply at the moment
something is written, which is the only moment they are free.

1. **An options object from the first version.** One required subject may be
   positional (`createPlaygroundLike(actions, post)`); everything else is a
   single object. A second positional parameter is a future reorder.
2. **Never a boolean parameter.** `open(true)` cannot grow a third state.
   A discriminated option can: `{ mode: "open" | "closed" | "detached" }`.
3. **Name by role, never by implementation.** This repository has already paid
   for the counter-example twice: `realtime` named a category the package did not
   fill, and `*RealtimeGuard` named a scenario rather than the rule it enforces.
   A name that describes WHAT it is outlives every change to HOW it works.
4. **Return an interface, not a class.** A class in a return type freezes its
   constructor and its whole member list.
5. **No `enum`.** A const object plus a union type: adding a member is safe,
   removal is visible, and it survives `erasableSyntaxOnly`, which this
   repository compiles with.
6. **Accept wide, return narrow.** Both directions of change then stay additive.
7. **Every default is a named export.** Replacing a default must never require a
   new API — it is an import the consumer already has.
8. **Every new option has a default that reproduces the previous behaviour.** An
   option that changes behaviour when absent is a break wearing an optional
   field's clothes.
9. **A callback's parameters are one object.** Adding a third argument to a
   two-argument callback silently changes what consumers' handlers receive.

---

## 7. Deprecation is the failure case

Reaching this section means §6 was not applied early enough. It is a recovery
procedure, not a plan.

### 7a. The ladder

| Stage | What happens                                            |
| ----- | ------------------------------------------------------- |
| 0     | Avoid it — §6 exists for this                           |
| 1     | Ship the replacement in a MINOR. Both work, both tested |
| 2     | Mark the old one, register it in the ledger             |
| 3     | It keeps working. Indefinitely                          |

There is no stage 4 in normal operation.

### 7b. What a mark must carry

Four facts, on the tag line, machine-checked:

- the tag,
- `since <version>` — the version the replacement shipped in, not the version the
  old thing appeared in,
- `use <replacement>` — a name, not a description,
- and one sentence of WHY, because "deprecated" without a reason reads as fashion
  and gets ignored.

A mark with no replacement is not a deprecation, it is an apology. If there is
nothing to point at, the thing is not deprecated — it is unfinished.

### 7c. A deprecated export keeps its tests

It is still executed code, and it is executed by people who have not migrated —
the exact population least able to diagnose a silent break. An untested
deprecated export is worse than a removed one, because it fails quietly and
in somebody else's build.

### 7d. The one exception: removal

A facade name may be removed only when ALL of the following hold:

1. it is unsafe or incorrect to keep — a security defect, or behaviour that
   corrupts consumer data. Tidiness is not a reason and never becomes one;
2. the replacement has shipped and coexisted for at least one full minor;
3. the removal lands in a major, with a migration note naming every removed name
   and its replacement;
4. the reason is written in the ledger beside the entry, permanently.

"We do not like the name any more" is answered by 6c, line 1: export both.

### 7e. The ledger

`api/deprecations.md` — one row per mark: name, tier, since, replacement, why.
It is the answer to "what will bite me", readable without reading code, and its
diff is where a reviewer sees a promise weakening.

The runtime half — a once-per-session development warning through `LankaLogger`
— arrives WITH the first deprecation and not before. A helper with no caller is a
declaration nothing builds from, and this repository has a rule about those.

---

## 8. The machine-checked half

A rule nobody can fail is a rule that reports success.

| Rule                                                            | Enforced by                   |
| --------------------------------------------------------------- | ----------------------------- |
| The `exports` map is exactly the facade plus the declared tiers | `publicSurface.test.ts`       |
| Every facade name is in the report, with its tier               | `scripts/check-api.mjs`       |
| A facade change without a report change fails                   | `scripts/check-api.mjs`       |
| A mark carries version, replacement and reason                  | `scripts/check-docs.mjs`      |
| A non-`A*` exported class declares no `protected` members       | `scripts/check-structure.mjs` |
| Every extension point has an occupant, every occupant a point   | the registry's own test       |
| Every facade export appears in a playground scene               | `scripts/check-api.mjs`       |
| An exemption from that whose name IS in a scene                 | `scripts/check-api.mjs`       |
| Nothing inside a package imports from a consumer                | `eslint.config.js`            |

The tiers `extend` and `internal` are exempt from the playground rule. Requiring
a scene there would push toward under-exposing, which is the failure this whole
skill is arranged against.

---

## 9. Anti-patterns

| Pattern                                                       | Why it fails                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Exporting a folder's contents because they were in the folder | this is how two internal registries became a promise nobody decided to make                                               |
| A tier that says one thing and a barrel that does another     | the reader believes the barrel; the barrel is not checked unless something checks it                                      |
| `unstable_` in a name                                         | the name is where a rename hurts most; put the instability in the PATH, which no consumer has to retype when it graduates |
| A "just this once" deep import into another package's `src/`  | it works until the file moves, and it moves because nobody knew it was load-bearing                                       |
| Deprecating to tidy up                                        | every mark spends the consumer's attention; spend it on correctness only                                                  |
| Adding an extension point for a future plugin                 | an imagined need costing real support; add it with its first occupant                                                     |
