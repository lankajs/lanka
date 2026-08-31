# skills

Rules that hold across the whole repository and belong to no single package.
Each lives in its own folder as `SKILL.md`.

| Rule                                         | Covers                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| [`naming/`](./naming/SKILL.md)               | Folders, files, symbols, parameters, config keys                                |
| [`structure/`](./structure/SKILL.md)         | What shares a file, what a barrel holds, where a test lives                     |
| [`composition/`](./composition/SKILL.md)     | Function length, branch shape, when repetition becomes an abstraction           |
| [`documentation/`](./documentation/SKILL.md) | Comments, docblocks, READMEs: language, content, length                         |
| [`plans/`](./plans/SKILL.md)                 | Where work-in-progress documents live, and when they die                        |
| [`surface/`](./surface/SKILL.md)             | What is promised, in which tier, and what admitting a name costs                |
| [`hosts/`](./hosts/SKILL.md)                 | Where each layer may run, and what the host framework owns instead              |
| [`forms/`](./forms/SKILL.md)                 | Whether a thing is a class, a factory, a frozen table or a function             |
| [`parity/`](./parity/SKILL.md)               | The two styles every role is written in, and how a project pins one             |
| [`performance/`](./performance/SKILL.md)     | What is measured, against what yardstick, and what a regression is              |
| [`testing/`](./testing/SKILL.md)             | Unit, playground and gate specs: what each answers, and what a test must assert |
| [`gates/`](./gates/SKILL.md)                 | How a canon gets an executable half, and what makes it worth running            |
| [`typescript/`](./typescript/SKILL.md)       | The language settings in force, and what each one forbids                       |
| [`commits/`](./commits/SKILL.md)             | What the log has to carry that the diff cannot                                  |

Three skills split one question three ways: `naming` is what a thing is CALLED,
`structure` is which file and folder it sits in, `composition` is how the code
inside that file is arranged.

## Versus a package README

A package README answers "what is this and why is it shaped this way". A skill
answers "how do I name and write the thing I am adding right now", identically
in all nineteen packages. Copying a skill into each README would create eighteen
copies, seventeen of which eventually drift.

## Versus a package SKILL.md

Every package also carries its own `SKILL.md` — its boundary, its invariants and
what to run before finishing. The dividing line is how many packages a rule is
true of: **all nineteen, and it lives here; one, and it lives there.** A rule
that starts in a package and turns out to be general moves up and leaves nothing
behind, because a pointer to a rule is cheap and a second copy of one is not.

A package's `GUIDE.md` is for a different reader altogether — somebody building
an application, who will never open this folder.

## Versus a plan

A plan describes an intended future and is deleted when the work lands. A skill
describes the present and lives as long as the repository.
