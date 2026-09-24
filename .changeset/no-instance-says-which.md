---
"lanka": patch
---

The error thrown when a call finds no lanka instance now says which of four things happened, rather than sending every reader to a `createLanka` call that may have run minutes earlier.

Reported against an application that upgraded lanka 2.1.0 → 2.2.0 under a running
Vite dev server: the open page kept 2.1.0, a module loaded afterwards got a fresh
2.2.0 evaluation with no instance, and the message said "Call createLanka({ host })"
about a page that had been rendering off one the whole time. A copy older than 2.2.0
does not announce itself to the copy check, so nothing better could be said.

- **Never had an instance, and no other copy has one** — the start-up message, now
  followed by what it means when `createLanka` DID run: another evaluation of lanka
  started empty, most often a dev server that kept the page open through an upgrade.
  Reload the page.
- **Had one, and it was cleared** — new. The instance was disposed (or deactivated),
  so the call outlived it, or the next one was never created and activated.
- **Another copy on the page has one** — the bundling advice as before, and the
  same dev-server upgrade beside it: from 2.2.0 on, the old copy announces itself
  and that case lands here.
- **A runtime resolver answered with none** — unchanged.

The success path of `requireActiveRuntime` is exactly what it was; the message is
built only on the way to a throw.
