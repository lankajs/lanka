# Composition

How code is arranged INSIDE a file: how long a unit may be, when a branch becomes
a lookup, and when repetition becomes an abstraction.

`skills/structure/SKILL.md` owns where a file sits and what shares it. This skill
owns what is written in it.

## The four rules

1. **A function does one thing at one level of abstraction.**
2. **Branch on data, not on control flow** — polymorphism over `switch`, `switch`
   over an `else if` chain.
3. **The third occurrence is the abstraction** — and it goes where both callers
   already look.
4. **An extension point is a contract, not a hook** — a consumer replaces a
   named thing, not a callback bag.

---

## 1. One thing, one level

A function reads as a sentence about its subject, in terms of the same size. When
a body mixes "decide the strategy" with "concatenate a header string", the reader
has to hold two altitudes at once.

**Signals, in the order they appear:**

| Signal | What it usually means |
| --- | --- |
| a blank-line-separated block with a comment above it | that block is a function, and the comment is its name |
| a name containing "and" | two functions |
| a local variable used only in one block | that block is a function taking it |
| a nesting depth of 3 | the innermost level is a function |
| 40+ lines | at least one of the above is present; go find it |

**40 lines is where to LOOK, not a limit to enforce.** A flat sequence of
declarations can be longer and read fine; a nested branch can be worse at fifteen.
The extraction has to leave both halves easier to name than the whole — if the
part you pulled out can only be called `handleRest`, it was not a part.

### 1a. What NOT to extract

- A block used once, with no name of its own, whose extraction forces five
  parameters. Five parameters is the function telling you it is not a unit.
- A step that only makes sense in this order, between these two neighbours.
  Extracting it hides the ordering constraint the reader needs.
- Anything that would make the caller read as a list of calls with no subject of
  its own. A function whose whole body is five calls has usually been split one
  level too far.

---

## 2. Branch on data, not on control flow

The ladder, best first:

**Polymorphism** — the branch disappears into the type. Each case is a class or an
object implementing one contract, and the caller has no branch at all.

**A lookup table** — `Record<TKind, THandler>`. The cases sit together where they
can be compared, the compiler checks exhaustiveness, and adding one is an entry
rather than an edit inside a function.

**`switch`** — when the cases are values, not behaviours: a mapping from a string
to a string, an exhaustive narrowing TypeScript understands.

**`else if` chain** — only when the conditions are not comparable at all: they
test different subjects, in an order that matters.

```ts
// worst — the conditions test different things, order is load-bearing and unstated
if (isPlainRecord(body)) { … } else if (Array.isArray(body)) { … } else if (body) { … }

// better — one subject, cases side by side, exhaustiveness checked
const EXTRACTORS: Record<TBodyShape, TExtractor> = { record: …, list: …, detail: … };

// best — the caller does not branch, and a consumer can add a case
export const lankaFirstOf = (...extractors) => (body) => { … };
```

**Why the order.** A branch inside a function is a decision only that function can
make; a table is a decision anyone can read; polymorphism is a decision the
consumer can EXTEND without touching the code that dispatches. For a framework
that last property is the whole point — see rule 4.

### 2a. When a chain is right

Guard clauses at the top of a function are not a chain: `if (!x) return` three
times is three independent refusals, not one decision with three cases. Leave
them.

---

## 3. The third occurrence is the abstraction

Two similar blocks are a coincidence. The third is a rule, and it gets a name.

Acting on the second costs more than it saves: the two are usually not the same
shape yet, and an abstraction built from two examples fits neither by the time the
third arrives.

**Where it goes:** the nearest place BOTH callers already look. Not a new
top-level folder — that makes the shared thing further from everyone than it was
from anyone.

| The occurrences are in | The extraction goes to |
| --- | --- |
| two files of one subject folder | that folder, as its own unit |
| two subject folders of one package | the package's shared level, named for what it IS |
| two packages | the base class or port they both already depend on |
| a base class and its subclasses | the base class — see 3a |

### 3a. The subclass smell

**When every subclass repeats the same eight lines, they belong to the base
class.** Then the subclass keeps only its difference, and the difference is what
the reader came for.

An abstract base that declares a contract and implements nothing is doing half a
job: it forces every implementation to re-derive the same orchestration and lets
them drift. The template goes in the base; the varying step is one abstract
method.

```ts
// before: three request classes, each with the same mock → send → check → throw
// after:  the base does that, and each subclass implements only `parse(response)`
```

---

## 4. An extension point is a contract, not a hook

A framework is extensible when a consumer can supply a THING, not a callback.

| Not extensible | Extensible |
| --- | --- |
| a boolean option that picks one of two built-ins | an interface the consumer implements |
| a callback taking five positional arguments | a named port with one method |
| an `if` on a config flag inside the framework | a lookup the consumer can add an entry to |

**The test:** can a consumer add a case without editing framework code, and can
the framework add one without breaking theirs? If either answer is no, the
extension point is a hook.

Every port in this repository is a named interface a consumer implements —
`ILankaValidator`, `ILankaLoggerSink`, `ILankaTransport`, `ILankaStorageAdapter`,
`ILankaPlugin`. When adding a seam, add one of those, not another config field.

### 4a. Where a contract is missing

Ask it of any family of two or more implementations that a consumer might
plausibly extend. If they share a base class but no interface, a consumer can
only extend by inheriting from OUR class — which is a dependency on our
implementation, not on our contract.

**The audit is mechanical.** List every base class with two or more subclasses;
for each, ask whether the base itself implements a named interface, and whether
the code that CONSUMES the family asks for that interface or for the class. The
answer to the second question is where the leak is: a port nobody accepts is a
port in name only.

`ILankaRequest` came out of exactly this. Three request kinds sat under
`ALankaRequest`, the base implemented nothing, and `ALankaGateway` held an
`ALankaRequest`. A consumer with a native bridge or an offline queue could not
supply one without inheriting a class built for `fetch`. The port is now what the
gateway holds, the base implements it, and a test builds a gateway on an
implementation that extends nothing of ours — so the seam cannot close again
without something going red.

### 4b. A port names the whole capability

Every argument the family's callers pass belongs in the interface, including the
ones that look like implementation detail. `execute` takes `mockHandler` because
development without a backend depends on it: a port that omitted it would type-
check and silently disable mock mode for whoever supplied their own request.

---

## 5. What the machine checks

`scripts/check-composition.mjs`, part of `pnpm check`:

| Tag | Fails when |
| --- | --- |
| `long-function` | A function body spans more than the recorded budget for its file. |
| `duplicate-block` | The same 6+ normalised lines appear in three or more files. |
| `else-if-chain` | Three or more `else if` branches on one subject. |

The budgets are a RATCHET, not a target: a file may shrink below its entry and
the entry follows it down, but nothing may grow past it. A ratchet that is raised
to make a build pass has stopped being one.
