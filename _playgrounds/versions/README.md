# \_playgrounds/versions

One small application per major of a peer the packages declare, so that a
widened peer range rests on a run rather than on a changelog.

| Application  | Runs                                                                        | Behind                                                  |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| `angular-21` | the Angular binding's every scene, and its testing entry with ATL 18        | `@lankajs/angular`: `@angular/core ^21`, ATL `^18`      |
| `angular-22` | the same, with ATL 19                                                       | `@lankajs/angular`: `@angular/core ^22`, ATL `^19`      |
| `vitest-4`   | the test kit's setup file, helpers and a conformance suite under Vitest 4   | `@lankajs/tool-testing`: `vitest ^4`                    |
| `vitest-5`   | the same under Vitest 5, and a real Vite 8 build through tool-di's adapter  | `@lankajs/tool-testing`: `vitest ^5`; tool-di: `vite ^8` |

The older end of each range — Angular 20, Vitest 3, Vite 7 — is what the
packages' own suites run on.

The scenes live in [`_shared`](./_shared) and every application runs the same
ones, so two majors are compared on identical text. Each run first asserts the
major it resolved: the packages are workspace source with their own copy of the
peer beside them, and a run that quietly used that copy would pass against the
wrong major. `skills/testing/SKILL.md` §9 is the rule, including why the Angular
applications need `resolve.dedupe` and the Vitest ones need nothing.

Angular 22 declares Node `^24.15`; the scenes run on the Node this repository
uses, and pnpm reports the engine mismatch without refusing it.

## Running them

```bash
pnpm --filter "./_playgrounds/versions/**" test
```
