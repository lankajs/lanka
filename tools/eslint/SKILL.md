# Maintaining `@lankajs/tool-eslint`

Six rules that check the framework's boundaries inside a consumer, plus the
ready-made `lankaBoundaries` config.

## Boundary

- A **tool**: lint configuration, not runtime. Nothing here ships in a bundle.
- It inspects a **consumer's** tree, which it does not know. Every folder name
  and import prefix is a setting with a default, never a constant.
- It works on the syntax tree alone. No type information, no module resolution.

## Invariants

1. **Every rule has a FAILING fixture.** A rule without one is a glob that
   matches nothing: it does not fail, it silently checks nobody. In this
   package's tests, "this code must be reported" matters more than "this code
   must pass" — and that is the general form of the repository's rule that a
   check which cannot fail reports success.

2. **Paths are settings, not constants.** A folder list baked into the package
   would mean the rule works for exactly one application. A different tree
   configures a rule; it does not switch it off.

3. **A rule never guesses.** `lanka/layer-style` deliberately omits plugins and
   bootstrap steps: their functional form is an object literal satisfying an
   interface, and recognising one without type information means guessing from
   property names. A rule that guesses reports a style nobody chose, and the
   fix a developer applies is to disable it.

4. **`no-gateway-to-gateway` does not forbid a shared base, transport or request
   class.** Those are the layer below both gateways, not one reaching the other.
   Widening it would ban the correct pattern along with the wrong one.

5. **`di-barrels-are-framework-only` pins an invariant that currently holds by
   itself.** That is the reason it exists: an invariant holding by accident stops
   holding silently.

6. **The ready-made config is frozen** and turns every rule on as an error. A
   consumer who wants less overrides it in their own config, visibly.

## Adding a rule

1. Write the failing fixture first, and watch it fail.
2. Give every path in it an option with a default that matches the reference
   tree.
3. Write the message so it says what to do instead — the message is the whole
   teaching surface of a lint rule.
4. Export the rule from `index.ts`, register it in `lankaEslintPlugin`, and add
   it to `lankaBoundaries`. All three, or the rule exists and runs nowhere.
5. Document it in `GUIDE.md` with the defect it prevents. A rule whose reason a
   reader cannot find is a rule they will disable.

## Tests and coverage

Beside each rule, using ESLint's `RuleTester`, plus the `_playground/` scene.

Coverage is a ratchet: statements 99, branches 95, functions 99, lines 99. High
because rules are small and total — an untested branch here is a case the rule
gets wrong in someone's repository.

## Before you finish

```bash
pnpm --filter @lankajs/tool-eslint test
pnpm --filter @lankajs/tool-eslint test:coverage
pnpm check
```

## Traps

**A rule that passes on everything.** Check the fixture actually reports. This is
the one failure mode a green test run will not show you.

**Hard-coding `ViewModels` or `@Gateways/`.** See invariant 2 — those are
defaults, and every use of them must go through the options.

**Using type information.** These rules run in consumer projects with whatever
parser they configured. Anything requiring `parserServices` works in some of them
and silently does nothing in the rest.

**Adding a rule to `lankaBoundaries` without exporting it.** The config then
references a rule the plugin does not register, and ESLint fails at load with a
message about a rule name rather than about the mistake.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
