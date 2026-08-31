---
name: lanka-optimistic
description: Apply a change to the screen before the server confirms it, cancel the requests it supersedes, and roll back correctly — with @lankajs/optimistic. Use when adding a like, a toggle, a rating, a submit, a delete or a join button; when double presses create duplicates or a stuck button; or when reviewing code that imports `@lankajs/optimistic`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/optimistic
    version: "0.0.0"
---

# @lankajs/optimistic

Optimistic mutations with **real request cancellation**. `reference.md` beside
this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

```ts
const actions = createLankaOptimisticActions(); // or: new LankaOptimisticActions()
```

## Choose by what counts as a failure

|                       | `runLatest`                        | `runExclusive`                         |
| --------------------- | ---------------------------------- | -------------------------------------- |
| second call, same key | cancels and supersedes the first   | does nothing, returns `"blocked"`      |
| the superseded call   | no success, **no rollback**        | —                                      |
| rollback on           | a real failure of the current call | **any** failure, cancellation included |
| use for               | like, rating, slider, search       | submit, delete, join, pay              |

Rapid presses must end on the last state, so a superseded call must not undo
anything. A one-shot action must not run twice, and anything that stops it must
undo the optimistic change.

## `runLatest`

```ts
await actions.runLatest(
	`todo:${id}:done`, // key: the slot calls supersede each other in
	() => {
		const previous = get().todos; // snapshot BEFORE writing
		set({ todos: markDone(previous, id) });
		return previous;
	},
	(signal) => gateway.setDone(id, { signal }), // pass the signal on
	(previous) => set({ todos: previous }),
	(result) => set({ todos: result }), // optional
);
```

## `runExclusive`

```ts
const outcome = await actions.runExclusive(key, apply, request, rollback, onSuccess, 10_000);

if (outcome === "blocked") return; // the user pressed twice — say nothing
if (outcome === "failed") toast("Could not delete");
```

Three outcomes, not a boolean: "already in flight" and "ran and failed" are
handled in opposite ways. The lock expires (15 s by default), because one hung
response would otherwise freeze the button until a reload.

## Without optimism

Pass `() => null` as the apply and skip the rest. You keep the cancellation — a
new search aborts the previous one — and give up nothing.

## Never do these

- **Never omit the signal from the gateway call.** Then nothing is cancelled: the
  superseded request still runs, still costs a connection, and still returns.
- **Never snapshot after the optimistic write.** The rollback would restore the
  change you were undoing.
- **Never treat `"blocked"` as an error.** It means the user pressed twice.
- **Never use `runLatest` for a delete.** A superseded delete does not roll back,
  so the row stays gone on a screen whose request never happened.
- **Never share a key between entities.** Include the id: `` `todo:${id}:done` ``.

## Symptom → cause

| What you see                                 | What it is                                  |
| -------------------------------------------- | ------------------------------------------- |
| two objects created by one double press      | `runLatest` where `runExclusive` was needed |
| a button dead until reload                   | a lock never released — check the deadline  |
| the screen reverts a change that succeeded   | rollback ran for a superseded call          |
| requests still on the wire after superseding | the signal was not passed to the gateway    |

## More

`reference.md` — the full guide, including holding one instance per ViewModel.
