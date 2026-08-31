# @lankajs/async

**▸ module** · Async primitives

> Which response may be trusted, and how many requests a burst actually sends.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `guard/` — request versioning: a late response learns it lost
- `coalescer/` — leading + trailing per key: a burst sends two requests, not a hundred
- `safe-fire-and-forget/` — unawaited start whose rejection is not lost in development
- `polling/` — interval subscription

---

Repository map: [../../README.md](../../README.md)
