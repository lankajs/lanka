# .specwarden — the list

Every check `pnpm check` runs, and the rule each one holds. The engine is
[specwarden](https://www.npmjs.com/package/specwarden); this folder is everything
it knows about lanka.

| File                    | What                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `config.mjs`            | the two tiers, and the inputs whose change makes every check relevant  |
| `rules.mjs`             | the rules several checks share, and the ones nothing in the list holds |
| `checks/canon/`         | one check per canon gate, wrapping `scripts/check-<subject>.mjs`       |
| `checks/generated/`     | generated output against its source: the registry, the router mirror   |
| `checks/packaging/`     | what reaches npm: the manifests, and the tarballs as installed         |
| `checks/workspace/`     | the toolchain: lockfile, lint, types, suites                           |
| `checks/agents/`, `checks/docs/`, `checks/security/` | checks installed from specwarden's modules, configured here |

## Where the logic lives

A gate's logic stays in `scripts/`, where its readers are pure, exported and
tested, and where a person runs it directly. A file here only puts it in the
list: the rule it enforces, the canon that owns it, and the success line that
proves it looked. A module's check is configured here and never re-implemented
as a script.

```bash
pnpm check                          # the whole list: fast tier, then heavy
pnpm run check:fast                 # every check that only reads files
pnpm exec specwarden check <id>     # one check
pnpm exec specwarden check --list   # the list, in order
pnpm run doctor                     # what is declared, and which rule each check holds
```

`skills/gates/SKILL.md` owns the rest — what earns a place in the list, and the
one measurement kept out of it.
