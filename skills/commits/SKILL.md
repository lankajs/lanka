# Commits

The log is the only place where the REASON for a change survives. The diff shows
what moved; the message is where "why this and not the obvious alternative" is
written down, and six months later it is the only copy.

## 1. The subject line

```
<type>(<scope>): <what changed, in a sentence that could be false>
```

- `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore` — and `feat!` when a
  published name changes meaning.
- The scope is the package or the subject: `core`, `collection`, `bench`, none at
  all for a repository-wide move.
- **The subject makes a claim.** "a sort key per row, not per comparison" can be
  checked; "improve sorting" cannot.
- A measured change carries its numbers: `— 23 945 → 17 056`. Numbers in the
  subject are what make a log skimmable for the one commit that explains today's
  regression.

## 2. The body answers what the diff cannot

Three questions, in whatever order the change needs:

1. **What was wrong before?** Not "this was slow" — *what* was slow and by how
   much: `a thousand rows is ten thousand comparisons, and each read the field
   twice`.
2. **Why this shape?** The alternative that was rejected and the reason. This is
   the part nobody can reconstruct.
3. **What was tried and did not work?** A measured non-improvement is worth as
   much as an improvement: it stops the next person spending the same afternoon.
   `Two further attempts were measured and reverted: … the collator dominates.`

## 3. Say what you did not do

A commit that leaves something out says so. The honest forms this repository uses:

- `One behaviour is deliberately not preserved: …` — with the reason.
- `The lazy variants stay factory-only on purpose. Lazy is a LIFETIME, not a role.`
- `Left exactly as it was — the rewrite would have been a real ring buffer nobody
  needed.`

A silent omission reads, later, as an oversight. A stated one reads as a decision.

## 4. Numbers are measured, not estimated

Never write a speedup you did not measure, and never write one measured once:
a single bench run lands within a few percent of the truth, which is the size of
most of these changes.

Three runs of each version, median reported, both sets in the body when they are
close:

```
Three runs of each: 4.96 / 4.84 / 4.80 against 10.48 / 9.92 / 9.70.
```

If the honest answer is "within noise", the commit says that and explains why the
change was kept anyway — or the change is reverted.

## 5. One change, one commit

A phase, a fix, a move — not two of them. The repository-wide moves in this log
are single commits ON PURPOSE (a bucket move plus its import rewrite is one
change), while a bucket move plus an unrelated optimisation is two.

When a commit mixes, split it before it lands: `git reset --soft HEAD~1` and
commit twice. It has been done here and the two honest commits were worth it.

## 6. What never appears

- A secret, a token, an IP address.
- `--no-verify`. If a gate is in the way, it is either right or it is a gate to
  fix, and both are visible work.
- A green claim nobody ran. "tests pass" is written after `pnpm check`, not
  instead of it.

## 7. The footer

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

on anything an agent wrote, so the log says who was at the keyboard.
