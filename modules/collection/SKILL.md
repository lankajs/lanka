# Maintaining `@lankajs/collection`

Pure list work: sort, filter, paginate, stabilise. No fetching, no storage, no
knowledge of what a row means. The whole package is functions and the memory they
keep.

## Boundary

- A **module**: the application calls it. Core does not know it exists.
- It imports nothing from this repository. Keep it that way — a dependency here
  would put list rendering behind a framework instance.
- It never writes state. `nextLankaSortState` is a pure function of the current
  state and deliberately not something handed a store's `set`/`get`: the
  ViewModel already owns writing, and a helper that writes for it works with
  exactly one state library.

## Invariants

1. **The four operations are separate calls, not one pipeline.** Their order is
   the application's: filter-then-sort and sort-then-filter give the same rows,
   but paginating before filtering gives a different page. A convenience pipeline
   would have to pick, and it would pick wrong for half the screens.

2. **A view is built once and held.** Every operation memoises on argument
   identity, and that memory is the product. Any change that makes a view cheaper
   to construct at the cost of what it remembers is a regression, however the
   bench reads.

3. **`stabilise` without `getId` answers the input untouched.** Guessing an
   identity — by index, by JSON — is how a sorted list starts swapping rows.
   Silent pass-through is the correct behaviour, not a gap.

4. **`stabilise` returns the same array when nothing changed**, not a new array
   of the same objects. Consumers compare by identity one level up.

5. **The operator union is closed.** An operator nobody implemented filters
   nothing and looks like an empty result. Adding one means adding a matcher in
   the same commit.

6. **Sorting decisions are visible in a table and are load-bearing**: empty
   first, dates and numbers as themselves, everything else lower-cased through
   `localeCompare`. Changing one of these changes what users see in every list.

7. **Sort keys are computed per row, not per comparison.** A thousand rows is
   about ten thousand comparisons; reading and coercing the field inside the
   comparator does that work ten times over. The decorate-sort-undecorate shape
   in `createLankaSorter` and the single reused `Intl.Collator` in
   `compareLankaSortKeys` are the reason the sort is what it is — and the
   collator, not the field reads, is what dominates the remaining cost.

## Tests and coverage

Beside each unit, plus the `_playground/` scene that drives a real table:
filter, sort, stabilise, paginate, in that order, with a refetch in the middle.

Coverage is a ratchet: statements 98, branches 97, functions 99, lines 98. New
branches must arrive with their tests — this package has dropped below its floor
once by adding branches without them.

What to pin, from experience: identity (the same array, the same row objects),
the empty-first ordering, an unknown operator, and a refetch where exactly one
row changed.

## Performance

`createLankaCollectionView.bench.ts`; baseline in `perf/collection.perf.md`, in
yardsticks.

**Bench the memo hit AND the miss, and label both.** The view memoises on
argument identity: pass the same array twice and the bench reports that sorting a
thousand rows is free. Give each case its own instance, too — two benches sharing
one view's memory make the order of the file decide the number.

## Before you finish

```bash
pnpm --filter @lankajs/collection test
pnpm --filter @lankajs/collection test:coverage
node scripts/check-perf.mjs
pnpm check
```

## Traps

**Adding a "pipeline" convenience.** See invariant 1. If a caller repeats the
same four lines, that is their ViewModel's helper, not this package's API.

**Making `compareLankaValues` configurable.** It is exported so an application
can call it; its rules are the product. A comparison strategy per view is
`matchers` for filtering and a custom `getValue` for sorting.

**Optimising the comparator further.** Two attempts have been measured and
reverted; the collator dominates. Measure before, and report "within noise"
honestly when that is the answer.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
