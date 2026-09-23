---
"@lankajs/any-schema": minor
---

TypeBox 1.x schemas are recognised as the `typebox` dialect, by the `~kind` their
builders set, beside TypeBox 0.34's `Symbol.for("TypeBox.Kind")`. Which
generation an application validates is decided by the validator it registers
under `typebox`: `@lankajs/typebox@2` for TypeBox 1.x, `@lankajs/typebox@1` for
0.34.
