# Plans

A plan is the working document for a piece of work that is not done yet.

## Contract

**A plan is ephemeral.** It is deleted when the work lands. A finished plan left
in a live corpus asserts a false present tense — that is the whole reason plans
are kept apart from documentation.

**A plan is never the source of truth about current behaviour.** It describes an
intended future state in the present tense, which a reader cannot tell from
fact. File and symbol names that do not exist yet are legal in a plan and
nowhere else.

**Nothing outside a plan links into one.** A plan links outward freely; no
README, TODO or skill links back. A pointer at something contractually doomed is
a dangling pointer with a delayed fuse.

**Harvest before deleting.** A finished plan almost always carries facts that
live nowhere else: a prohibition, a rejected alternative, the reason for the
chosen shape. Each moves to the document that owns the subject — the package
the package `README.md`, a comment beside the decision, a rule in a `SKILL.md` —
and only then does the
plan go. An unharvested plan deleted is a lost thought.

## Where

`_plans/<NN>-<slug>.md`, numbering continuous across the repository's life so a
number is never reused. The folder is empty whenever no work is in flight, and
that is its normal state.
