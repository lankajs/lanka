---
description: Add or change a published name — tier, form, parity, report, scene.
argument-hint: "<the name, and what it does>"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

A new name is being published from **lanka**: `$ARGUMENTS`

Almost everything here is a PROMISE — a name in a barrel is kept until a major
version — so the order below is not optional, and step 1 comes before any code.

## 1. Read, in this order

- `skills/surface/SKILL.md` — the three tiers and what admission costs
- `skills/forms/SKILL.md` — class / factory / frozen table / function / ambient
- `skills/parity/SKILL.md` — if this is a ROLE
- `skills/naming/SKILL.md` — before the name is typed anywhere
- `api/<package>.api.md` — what is already promised, and at which tier

## 2. Decide, and say the decision out loud

- **Tier**: `facade`, `extend`, or `internal`. Chosen after the fact is chosen by
  accident. A name only ever moves toward MORE public, never back.
- **Form**: what shape the thing takes, and why the other four are wrong for it.
  A static-only class is banned; a class that consumers may extend needs its
  admission to `SUBCLASSABLE`.
- **Parity**: a ROLE ships all three — `ILankaX`, `ALankaX`, `createLankaX` — over
  ONE implementation, the factory being a bridge subclass. Protected names must
  equal the context field names.

## 3. Write it, then prove it

```bash
node scripts/check-forms.mjs
node scripts/check-parity.mjs
node scripts/check-api.mjs           # fails: the report has not been updated
node scripts/check-api.mjs --write   # record the new surface
node scripts/check-points.mjs
pnpm check
```

A new published name also needs a **playground scene** — `check-api` refuses it
otherwise, and a unit test does not satisfy that rule: a scene shows how a
consumer uses the thing.

## 4. The commit

The `api/*.api.md` diff IS the review. Put in the message what was promised and
at which tier, so the reason survives the person.
