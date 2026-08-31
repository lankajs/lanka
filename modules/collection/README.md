# @lankajs/collection

**▸ module** · Lists a screen reads

> Sort, filter and paginate on the client without handing React a new array every time.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `createLankaCollectionView` — sort, filter, paginate and stabilise, each memoised on the arguments it was given
- `nextLankaSortState` — the header-click cycle: ascending, descending, off
- `lankaFilterMatchers` — the ten operators as a table a consumer adds to

## The point is the reference, not the order

Sorting a list is four lines. What this package is for is what happens next: a new array every render is a new prop for every row, and a screen with two hundred of them repaints because somebody typed into a filter.

So every operation answers with the array it was GIVEN when nothing changed, and `stabilise` goes further: it reuses the previous object for each row whose contents are equal, so a list that refetched identical data hands React the same items.

## No inheritance, and no set/get

The ancestor of this package was one class domains subclassed to override how a value is read and how an operator matches. Both are now parameters: `getValue` and a table of matchers. A protected member is a contract a consumer discovers by breaking (see the structure canon), and neither of these needed to be one.

The sort cycle is a PURE function of the current state rather than something handed a store's set/get: the ViewModel already owns writing, and a helper that writes for it works with exactly one state library.

---

Repository map: [../../README.md](../../README.md)
