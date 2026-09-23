---
"@lankajs/angular": minor
---

Angular 21 and 22 are supported: the peer range is now
`@angular/core ^20.0.0 || ^21.0.0 || ^22.0.0`, and the testing entry's
`@testing-library/angular ^17.4.0 || ^18.0.0 || ^19.0.0`.

`^20` alone made npm refuse to install the binding beside either of the two
current majors (ERESOLVE). The range widens only to majors that ran:
`_playgrounds/versions/angular-21` and `-22` run every scene the binding is held
to — the shared view-binding conformance suite and the testing entry — against
Angular 21 with Testing Library 18 and Angular 22 with Testing Library 19, after
asserting the major each one actually resolved.
