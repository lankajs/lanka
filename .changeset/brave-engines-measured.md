---
"lanka": minor
"@lankajs/tool-testing": minor
"@lankajs/storage": patch
---

The storage port moves into core, and gains a suite that can fail

`ILankaStorageAdapter` and its two halves are now declared in `lanka/storage` —
types only, zero runtime, called by nothing inside core, exactly as `lanka/cache`
is. `@lankajs/storage` re-exports all three names, so an application importing
them from there keeps working and always will.

**Why the port moved, when the module owns every implementation.** A family of
adapters promises interchangeability, and the only honest way to check that
promise is a shared conformance suite — which lives in `@lankajs/tool-testing`.
The kit depends on `lanka` and on nothing else, and its own notes said so: a
double over a MODULE's port would invert the direction the whole repository
points. So the suite was impossible while the port sat in a module, and a family
with no suite is packages promising interchangeability with nothing checking it.

The alternative — amending the structure canon from "the same core port" to "the
same port" — was rejected. It would have been one sentence instead of a
subsystem, but the kit's objection is not about the canon's wording and no
wording fixes it.

**`@lankajs/tool-testing` gains `lankaStorageAdapterConformance`**: ten clauses
as DATA, so the suite's own spec can point each scene at an adapter that is
broken on purpose and assert that the scene fails. Twelve such adapters are in
that spec, and every one of them is a bug somebody has shipped — an engine that
parses JSON on the way out, a `clear` that empties its key index and leaves the
values, a ceiling that truncates instead of refusing. It also gains
`createLankaFakeStorageAdapter`, the port's second implementation: an interface
with one implementation is not an abstraction.

**One clause is deliberately the opposite of the read cache's.** `cancel` on
`ILankaReadCache` is optional because three of four libraries could not do it,
and a cache that cannot cancel merely finishes a request nobody wants. `clear()`
stays REQUIRED here, because a store that cannot clear ends a session with the
tokens still in it — waste versus the failure itself. An engine that can neither
enumerate nor wipe, which is `expo-secure-store`, keeps its own index instead;
the cost lands on the one adapter with the problem rather than on every caller.

**What the suite found when it was pointed at what already exists.** No broken
clause: `LankaWebStorageAdapter`, `LankaCacheStorageAdapter` and the playground's
own memory adapter pass all ten. Two wrong documents: `LankaIndexedDbAdapter`
does not bind this port at all — it holds `Blob`s for `@lankajs/blob-cache`,
which its own file header states in its first paragraph — while its class
docblock and the package README both called it a third handler of the same port.
Both now say what the code does. Nothing moved in the code.
