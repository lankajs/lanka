<!-- Generated from modules/optimistic/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

# @lankajs/optimistic — user guide

Optimistic mutations with **real request cancellation**. You apply the change to
the screen immediately, send the request, and roll back if it fails — and the
requests you superseded are actually aborted rather than left racing.

## You will learn

- how to make a button feel instant without lying about what happened
- which of the two strategies a given control needs, and why the choice is not stylistic
- why cancellation is the feature, and what breaks without the abort signal

## When to reach for this

Reach for it the first time a user can press something twice. Below that — a
control that cannot be pressed again until it answers — a plain `await` in the
ViewModel is enough.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/optimistic
```

## Two strategies, and how to choose

```ts
import { createLankaOptimisticActions } from "@lankajs/optimistic";

const actions = createLankaOptimisticActions();
// class twin: new LankaOptimisticActions()
```

|                         | `runLatest`                        | `runExclusive`                         |
| ----------------------- | ---------------------------------- | -------------------------------------- |
| A second call, same key | cancels and supersedes the first   | does nothing, returns `"blocked"`      |
| The cancelled call      | no success, **no rollback**        | —                                      |
| Rollback happens on     | a real failure of the current call | **any** failure, cancellation included |
| Typical use             | a like button, a rating, a slider  | "submit", "delete", "join"             |

The split is not about convenience. It is about what counts as a failure. Rapid
repeated presses should end on the last state, so a superseded call must not roll
anything back. A one-shot action must not run twice, and anything that stops it
must undo the optimistic change.

## `runLatest` — the last click wins

```ts
await actions.runLatest(
	`todo:${id}:done`, // key: the slot calls supersede each other in
	() => {
		// apply, and return a snapshot
		const previous = get().todos;
		set({ todos: markDone(previous, id) });
		return previous;
	},
	(signal) => gateway.setDone(id, { signal }), // the request, given the abort signal
	(previous) => set({ todos: previous }), // rollback
	(result) => set({ todos: result }), // optional: the server's answer
);
```

The signal is the point: pass it to the gateway, and a superseded request stops
consuming a connection instead of racing the one that replaced it.

A cancelled call runs neither `onSuccess` nor `rollback` — the state it would
restore has already been replaced by a newer intent.

## `runExclusive` — a hard per-item lock

```ts
const outcome = await actions.runExclusive(
	`todo:${id}:delete`,
	() => {
		const previous = get().todos;
		set({ todos: without(previous, id) });
		return previous;
	},
	(signal) => gateway.remove(id, { signal }),
	(previous) => set({ todos: previous }),
	() => toast("Deleted"),
	10_000, // optional deadline; default 15s
);

if (outcome === "blocked") return; // already in flight — say nothing
if (outcome === "failed") toast("Could not delete");
```

**Three outcomes, not a boolean.** "Not run, already in flight" and "run and
failed" have to be handled in opposite ways — the first silently, the second with
a message — and a boolean cannot tell them apart.

**The lock expires.** Without a deadline, one hung server response freezes the
button until a reload. When the deadline passes, the request is aborted and the
change is rolled back.

## Without optimism

Both strategies work as plain concurrency control. Pass an empty apply and skip
the rest:

```ts
await actions.runLatest(
	"search",
	() => null,
	(signal) => gateway.search(term, { signal }),
	() => {},
);
```

You keep the cancellation behaviour — a new search aborts the previous one — and
give up nothing.

## Keys

A key is the slot in which calls compete. Include the entity id:
`` `todo:${id}:done` ``, not `"done"`. Two different todos sharing a key means
pressing one silently cancels the other.

## Living where the screen lives

One instance per ViewModel, held for as long as the screen:

```ts
const actions = createLankaOptimisticActions();

export const createTodosVM = () =>
	createLankaVM({
		name: "TodosVM",
		states: { todos: [] },
		createActions: ({ set, get }) => ({
			toggle: (id: number) => actions.runLatest(/* … */),
		}),
	});
```

## Common mistakes

**Not passing the signal to the gateway.** Then nothing is cancelled: the
superseded request still runs, still costs a connection, and still returns —
you simply ignore the answer.

**Taking the snapshot after the optimistic write.** `applyOptimistic` must return
the state as it was _before_ it wrote, or the rollback restores the change you
were undoing.

**Treating `"blocked"` as an error.** It means the user pressed twice. Show
nothing.

**Using `runLatest` for a delete.** A superseded delete does not roll back, so
the row stays gone on a screen whose request never happened.

## Recap

- `runLatest` supersedes: a cancelled call runs neither success nor rollback. For repeated presses that must end on the last state.
- `runExclusive` locks: three outcomes, and the lock expires so a hung server cannot freeze a button.
- Pass the signal to the gateway, or nothing is actually cancelled.
- Snapshot **before** the optimistic write.
- Keys carry the entity id; a shared key means one press cancels another.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/optimistic/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/optimistic/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
