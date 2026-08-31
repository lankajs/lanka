<!-- Generated from modules/collection/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

# @lankajs/collection — user guide

Everything a screen does to a list before it renders it: **sort**, **filter**,
**paginate**, and **stabilise** — keeping the same object for a row whose
contents did not change, so React does not re-render rows that did not move.

It is pure data work. It does not fetch, does not store, and does not know what
a row means.

## You will learn

- why a list view is built once and held, not created per render
- how to sort, filter, paginate and stabilise, and why the order is yours
- what makes rows stop re-rendering after a refetch

## When to reach for this

Reach for it when a screen shows a list the user can reorder, search or page
through. A list rendered once from the server needs nothing here.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/collection
```

## One view per list

```ts
import { createLankaCollectionView } from "@lankajs/collection";

const view = createLankaCollectionView<ITodo, number>({
	getValue: (todo, field) => todo[field as keyof ITodo],
	getId: (todo) => todo.id,
});
```

**Build it once and hold it for as long as the list.** Each of the four
operations remembers its last answer, and the memory _is_ the product: a view
rebuilt on every render remembers nothing and costs more than calling the plain
functions. In a ViewModel that means building it beside the state, not inside an
action.

```ts
export const createTodosVM = () => {
    const view = createLankaCollectionView<ITodo, number>({ …  });

    return createLankaVM({
        name: "TodosVM",
        states: { todos: [], sort: { field: null, order: null }, page: 1 },
        createActions: ({ get }) => ({
            rows: () => {
                const { todos, sort, page } = get();
                const filtered = view.filter(todos, rules);
                const sorted = view.sort(filtered, sort);
                return view.paginate(view.stabilise(sorted), page, 20);
            },
        }),
    });
};
```

### Why four calls instead of one pipeline

Because the **order is the application's**. Filter-then-sort and sort-then-filter
give the same rows, but paginating before filtering gives a different page — and
only the screen knows which it means.

## Sorting

```ts
const sorted = view.sort(todos, { field: "title", order: "asc" });
```

`ILankaSortState` is `{ field: string | null, order: "asc" | "desc" | null }`.
A `null` field means "leave the order the server sent".

For a clickable table header:

```ts
import { nextLankaSortState } from "@lankajs/collection";

onHeaderClick: (field: string) => set({ sort: nextLankaSortState(get().sort, field) });
```

**Three states, not two:** ascending, descending, off. The third is the only way
back to the server's order, and a table whose sorting cannot be undone forces a
reload to see it.

### How values compare

`compareLankaValues` is exported, and it makes three decisions you can see in a
table:

- **Empty sorts first.** A row with nothing in the column is usually the row the
  user is hunting for — the one nobody filled in.
- **Dates and numbers compare as themselves.** Sorting a date as a string puts
  the 2nd of May after the 19th of April and looks like a server bug.
- **Everything else compares as lower-case text** through `localeCompare`, so "Ä"
  lands beside "A" rather than after "Z".

## Filtering

```ts
const rows = view.filter(todos, [
	{ field: "title", value: search }, // contains, by default
	{ field: "status", value: ["open", "blocked"], operator: "in" },
	{ field: "due", value: today, operator: "lte" },
]);
```

| Operator                             | Matches                    |
| ------------------------------------ | -------------------------- |
| `eq`, `neq`                          | equal / not equal          |
| `contains`, `startsWith`, `endsWith` | text                       |
| `gt`, `gte`, `lt`, `lte`             | ordered values             |
| `in`                                 | the value is one of a list |

The default is `contains`, which is what a search box means.

The operator set is a **closed union**. An operator nobody implemented would
otherwise filter nothing and look like an empty result.

Two escape hatches per rule:

```ts
{ field: "owner", value: "ada", getValue: (todo) => todo.owner.name }  // a computed column
{ field: "any", value: q, match: (rowValue, ruleValue) => customCheck(rowValue, ruleValue) }
```

`match` decides the rule outright and beats the operator. Replace the whole set
with `matchers` on the view when your application has its own comparison rules.

## Paginating

```ts
const { items, totalPages } = view.paginate(rows, page, 20);
```

## Stabilising

```ts
const stable = view.stabilise(rowsFromServer);
```

After a refetch, every row is a new object even where nothing changed — so every
memoised row component re-renders. `stabilise` returns the **previous object**
for each row whose contents are unchanged, and the same array when nothing at all
changed.

It needs `getId` on the view. Without a way to recognise a row across refetches
there is nothing to keep, so `stabilise` answers the input untouched — and that
is deliberate: guessing an identity by index or by JSON is how a sorted list
starts swapping rows.

Put it **after** sorting and filtering and **before** rendering.

## Common mistakes

**Rebuilding the view inside a render or an action.** Then nothing is memoised,
and you have paid for a feature you are not using.

**Calling `stabilise` without `getId`.** It quietly does nothing. If rows still
re-render, that is the first thing to check.

**Expecting `filter` to search nested fields by path.** `getValue` reads the
field; nested paths and computed columns live there, or in a rule's own
`getValue`.

**Paginating before filtering** when you meant "page 2 of the results". Both
orders are legal; only one is what your screen says.

## Recap

- One view per list, built beside the state — the memory **is** the product.
- Four calls, not one pipeline: paginating before filtering is a different page, and only the screen knows which it means.
- Sorting: empty first, dates and numbers as themselves, everything else through `localeCompare`.
- `stabilise` needs `getId`; without it, it quietly does nothing.
- The operator set is closed — an unknown operator would filter nothing and look like an empty result.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/collection/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/collection/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
