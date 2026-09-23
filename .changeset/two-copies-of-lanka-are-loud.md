---
"lanka": minor
---

Two copies of `lanka` on one page are no longer silent.

Several UI frameworks in one application are supported — a migration done
screen by screen, modules owned by different teams, micro-frontends — over ONE
copy of `lanka` on the page. Each copy has its own bus and its own pointer to
the running instance, so when a separately built module bundles its own copy, a
scenario triggered through one never reaches a ViewModel registered with the
other. Until now nothing reported it: both halves of the page rendered, and one
of them never updated again.

## What changes

- **In development, a copy that loads onto a page where another copy is running
  warns once**, naming the fix: a singleton in Module Federation's `shared`, an
  import map, or `lanka` external in the module's build. Loading is checked, not
  only starting, because the commonest form of the accident is a bundled copy
  that is never started — the shell already did that.
- **In development, a copy that starts while another copy runs warns once**, for
  the same reason.
- **In any mode, `lanka used before an instance existed` now says when another
  copy on the page has one**, instead of sending the reader looking for a missing
  `startLanka`.

Two instances of ONE copy — `createLanka`'s promised isolation — stay silent,
and so does a production page: two copies there may be two applications kept
apart on purpose.

## What you do

Nothing, unless you see the warning. If you do and the modules are meant to
share state, ship one `lanka`. `ARCHITECTURE.md`, "Several frameworks in one
application", has the table for one bundle and for separate builds.

A test double passed to `setActiveLankaRuntime` from `lanka/internal` now needs
`getFlags()`, which `ILankaRuntime` always declared.
