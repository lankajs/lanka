---
"@lankajs/tool-testing": minor
---

Vitest 4 and 5 are supported: the peer range is now
`vitest ^3.2.4 || ^4.0.0 || ^5.0.0`.

`_playgrounds/versions/vitest-4` and `-5` run the kit under each — its setup
file, `resetLanka`, `lankaTestHost` and a conformance suite registering into the
running Vitest — after asserting which major is running.
