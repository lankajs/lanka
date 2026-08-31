# @lankajs/tool-eslint

**⚒ tool** · Boundary rules

> The framework's main promise — imports go one way — is checked by the framework, not by its consumers.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Why the rules live here

A framework whose main promise is verified by copies of a script inside each consumer
does not verify it at all, and the third consumer gets nothing.

## Every rule has a FAILING fixture

A rule without one is a glob that matches nothing: it does not fail, it silently checks
nobody. Fifteen rule blocks once went quiet at once this way, and nothing went red.

Fixtures are shaped like a CONSUMER, not like the framework: the rules inspect an
application tree, so a fixture built from framework files would prove the wrong thing.

## The ready-made config is for an application

`lankaBoundaries` cannot be applied to the framework itself: the `@lanka_di/*` rule
forbids exactly the inversion the framework stands on. Paths in the rules are settings —
a different tree configures them, it does not switch them off.

---

Repository map: [../../README.md](../../README.md)
