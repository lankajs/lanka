# Performance

A number you can optimise against, and a gate that stops a regression without
stopping an optimisation.

The rule the rest follows from: **a measurement that asserts nothing is not a
test.** Forty-five blocks in this repository were named `stress`, ran a thousand
iterations, printed a duration and passed unconditionally. They cost time on
every run and could not fail. Fourteen of them measured only that — they are
gone, and what they were reaching for lives in `perf/`.

## 1. What is measured

A hot path is one an application walks per render, per request or per start.
Everything else is measured when there is a reason to, not on principle.

| Package                  | Bench                                                       | Why it is hot                                |
| ------------------------ | ----------------------------------------------------------- | -------------------------------------------- |
| core                     | tracked hook: a render reading four keys                    | every render of every screen                 |
| core                     | ViewModel: building one; an action writing a field; a read  | opening a screen, then every tap             |
| core                     | blind-spot trap: an armed read against a bare one           | the diagnostic that is on in development     |
| core                     | locator proxy: resolving a name                             | every access to every gateway and singleton  |
| core                     | gateway: `endpoint()` and the query builder                 | every request, before any I/O                |
| core                     | event bus: dispatch to nobody, to one, to ten               | every scenario trigger                       |
| `@lankajs/collection`      | sort, filter, paginate, stabilise over 1000 rows            | every keystroke in a table                   |
| `@lankajs/storage`         | id registry: encode a known id, decode, mint                | every row of every list that remembers       |
| `@lankajs/async`           | burst coalescer: one call, then ten at once                 | every burst of identical refreshes           |
| `@lankajs/plugin-http`     | a safe and an unsafe request through the middleware chain   | every request the application makes          |
| `@lankajs/plugin-sse`      | a message from raw event to scenario; one nobody listens to | every message, at a rate the server sets     |
| `@lankajs/plugin-prefetch` | warming a known key, claiming it, warming a new one         | every hover and every row scrolled into view |

## 2. Why a ratio and not a millisecond

`27,212,092 ops/sec` is a fact about one machine on one afternoon. A laptop on
battery answers half of it; CI answers something else again. Recorded as a
baseline it produces a check that fails for reasons nobody caused, and a check
that cries wolf stops being read.

So every bench file registers **one yardstick of its own** —
`lankaBenchCalibration()`, a plain property read — and what `perf/<pkg>.perf.md`
records is how many of those one call costs. The machine, the thermal state and
the noise of a parallel run scale both numbers together, and the ratio survives.

**In every file, not once per package.** Vitest gives each bench file its own
worker, and a yardstick measured in another process is a yardstick measured on
another machine as far as this is concerned. It costs 0.25s per file, against
the 3s that starting the worker already cost — which is also why benches are
grouped by file rather than split one per case.

## 3. The tolerance

**1.6× of the recorded ratio.** Not caution — a division of labour. Two
consecutive runs of an unchanged bench land within about 3% of each other, and a
run under parallel load within about 15%. This gate exists to catch _it became
three times dearer_; one that also fired at four percent would be switched off
within a week, and then nothing would catch either.

### When the gate disagrees with itself

Those two figures describe a machine doing one thing at a time. A machine doing
something else is a different instrument: on one Windows laptop the SAME tree
reported zero regressions and then thirty in consecutive runs, all of them
uniform at about 2×, across twelve unrelated packages — and reported the same
thirty against `HEAD` after a `git stash`, which is what proved it was not the
code.

**The gate now asks the second question itself.** A flagged regression is measured
again, in a fresh process, and only what BOTH runs call a regression is reported;
the rest is printed as "flagged once and not by the second measurement — this
machine is a poor instrument today, do not record here". A real 1.6× reproduces;
an idle-versus-busy artefact does not. What follows is still worth knowing,
because the gate can only repeat a measurement — it cannot tell you the machine
was busy, and it will not stop you recording a baseline on one.

**CI is the contended machine, always.** A two-core shared runner is not the
instrument these baselines were recorded on: the first CI run of this repository
flagged proxy tracking in core, a ring buffer in devtools and the http request
chain at 1.69×, 2.05× and 2.14× in one pass, with none of that code touched. That
is why the repetition lives in the gate rather than in an instruction nobody
follows on a build server.

So the reading to distrust is not a big number, it is a UNIFORM one. Thirty
operations that share nothing do not slow down together; a yardstick measured on
a busy core does. When that happens:

- **do not record.** A baseline written from such a run bakes noise into a
  ratchet that only tightens, and every later run compares against a fiction;
- **do not investigate the code first.** Stash and run against `HEAD`. If the
  regressions survive without your changes, they were never yours;
- **re-run when the machine is idle**, and believe the two runs that agree.

Getting faster is never a failure. Record it with `--write` and let the diff say
what improved — that reading is the review, exactly as it is for `api/`.

Raising a recorded number to make the gate pass is the same move as raising a
coverage threshold: the ratchet stops being one. The honest version is a `--write`
whose diff a reviewer sees, in the same commit as the change that spent the time.

## 4. Writing a bench

```ts
describe("createLankaTrackedHook", () => {
	lankaBenchCalibration();

	bench("a screen reading four keys", () => { ... }, LANKA_BENCH_OPTIONS);
});
```

Four things the benches here already learned:

- **Measure the memo AND the miss.** The collection view memoises on argument
  identity, so a bench that passes the same array twice measures the cache and
  reports that sorting a thousand rows is free. Both sides are named in the
  bench, because a screen pays both.
- **Give the engine something it cannot skip.** A subscriber with an empty body,
  a read whose result goes nowhere — an optimising engine deletes the work and
  the bench reports the speed of nothing. Every yardstick and every handler here
  accumulates into a value something later reads.
- **State what the bench cannot separate.** A render is mostly React, and React
  is not this repository's code. The bench renders the same component twice —
  once through the hook, once over a plain object — so the DIFFERENCE is the part
  anybody here can act on.
- **Activate a framework when the path needs one.** `endpoint()` reads the host's
  base URL; benched without an instance it throws, and vitest records `NaN`.

## 5. What the machine checks

`scripts/check-perf.mjs`, run by `pnpm run check:perf` — **deliberately, on an
idle machine**, and NOT by `pnpm check`. The chain holds checks that read files
and answer the same anywhere; this one measures, and it is judged only where
somebody chose to hold the stopwatch. CI runs `check:perf:report`, which prints
every ratio and exits zero. The reason, and the test for admitting a second
exception, are in `skills/gates/SKILL.md` §1.

| Command                       | Does                                          |
| ----------------------------- | --------------------------------------------- |
| `pnpm run check:perf`         | judges, and fails on a confirmed regression   |
| `pnpm run check:perf:write`   | records the baseline — idle machine only      |
| `pnpm run check:perf:report`  | prints and never fails; what CI runs          |

| Tag                 | Fails when                                                                   |
| ------------------- | ---------------------------------------------------------------------------- |
| `perf-regressed`    | a ratio grew past the tolerance                                              |
| `perf-report-stale` | a bench with no recorded number, or a number nothing measures                |
| `perf-uncalibrated` | a bench group with no yardstick — its numbers cannot be compared to anything |

It costs about a minute for the whole repository, and about twice that for a
package whose bench flagged, because a flag is measured again before it is
believed. `pnpm bench` prints the same numbers without comparing them, for
reading while optimising.

## 6. Anti-patterns

| Pattern                                         | Why it fails                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| A test that times something and asserts nothing | it cannot fail, so it reports success — and charges for it on every run |
| A baseline in milliseconds                      | fails on a different machine, and is then deleted rather than fixed     |
| A tolerance tight enough to catch noise         | gets switched off, and takes the real regressions with it               |
| Benching the memo and calling it the operation  | reports that the expensive path is free                                 |
| An empty benched body                           | measures the engine deleting it                                         |
