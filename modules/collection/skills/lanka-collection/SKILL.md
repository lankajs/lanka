---
name: lanka-collection
description: Sort, filter, paginate and stabilise a list a screen renders — with @lankajs/collection. Use when building a table or a searchable list, when every row re-renders after a refetch, when a date column sorts wrongly, or when reviewing code that imports `@lankajs/collection`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/collection
    version: "0.0.0"
---

# @lankajs/collection

Pure list work: sort, filter, paginate, stabilise. No fetching, no storage.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Build the view ONCE and hold it

```ts
const view = createLankaCollectionView<ITodo, number>({
	getValue: (todo, field) => todo[field as keyof ITodo],
	getId: (todo) => todo.id, // without it, stabilise does nothing
});
```

Each operation memoises its last answer, and that memory **is** the product. In a
ViewModel, build it beside the state — never inside an action or a render.

## Four calls, and the order is yours

```ts
const filtered = view.filter(todos, rules);
const sorted = view.sort(filtered, sortState);
const stable = view.stabilise(sorted); // after sorting, before rendering
const { items, totalPages } = view.paginate(stable, page, 20);
```

Not one pipeline, because filter-then-sort and sort-then-filter give the same
rows while paginating before filtering gives a different page — and only the
screen knows which it means.

## Sorting

```ts
onHeaderClick: (field) => set({ sort: nextLankaSortState(get().sort, field) });
```

Three states: ascending → descending → **off**. The third is the only way back to
the server's order.

`compareLankaValues` decides: empty first, dates and numbers as themselves,
everything else lower-cased through `localeCompare`.

## Filtering

```ts
view.filter(todos, [
	{ field: "title", value: search }, // `contains` by default
	{ field: "status", value: ["open"], operator: "in" },
	{ field: "owner", value: q, getValue: (t) => t.owner.name }, // computed column
]);
```

Operators: `eq` `neq` `contains` `startsWith` `endsWith` `gt` `gte` `lt` `lte`
`in`. The set is closed — an unknown one would filter nothing and look like an
empty result. A rule's own `match` decides it outright and beats the operator.

## Stabilising

Returns the **previous object** for every row whose contents are unchanged, and
the same array when nothing changed — so memoised rows stop re-rendering after a
refetch.

## Never do these

- **Never rebuild the view per render or per action.** Nothing is memoised then,
  and you pay for a feature you are not using.
- **Never call `stabilise` without `getId` on the view.** It quietly does nothing;
  guessing identity by index or JSON is how a sorted list swaps rows.
- **Never expect `filter` to walk a nested path.** Nested and computed columns go
  through `getValue`, on the view or on the rule.
- **Never write a comparison inline instead of `compareLankaValues`.** Sorting a
  date as a string puts the 2nd of May after the 19th of April.

## Symptom → cause

| What you see                             | What it is                                  |
| ---------------------------------------- | ------------------------------------------- |
| every row re-renders after a refetch     | no `stabilise`, or no `getId`               |
| the list is slow and memoisation is "on" | the view is rebuilt somewhere in the render |
| a filter returns nothing                 | an operator outside the closed set          |
| page 2 shows unfiltered rows             | paginated before filtering                  |

## More

`reference.md` — the full guide, with `matchers`, the page shape and the sort
state type.
