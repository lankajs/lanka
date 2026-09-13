---
"lanka": patch
---

A server can construct a lanka instance: the locator's export order, and adoption that waits

Two defects that only appear together, and only on a server. Either one alone
made `@lankajs/host` unusable there, and both were invisible in a browser.

**The barrel exported the facade before the marker it needs.** `lanka/locator`
listed `lankaSingletons` ahead of `ALankaSingleton` and `createLankaSingleton`.
The facade reads `@lanka_di/Singletons` — an application's barrel — and that
barrel declares classes extending `ALankaSingleton`. So whoever imported the
locator first evaluated the facade, which evaluated the application's barrel,
which reached for a base class this module had not defined yet: `TypeError: Class
extends value undefined`, from a file the application never wrote. A bundler
hides it exactly as often as it does not.

The order is now marker, factory, facade, with a guard in core's own surface spec
— an export list is a thing people reorder alphabetically while tidying.

**`createLanka` adopted its declared ViewModels immediately.** Adoption needs an
active runtime. Under `setLankaRuntimeResolver` there is none until a request is
in flight, and `createLanka` IS what a request runs to make one — so constructing
an instance threw about a missing request scope from inside the call that was
creating it.

Adoption now returns early when no runtime is active, and `bootstrap()` runs it
again. Skipping outright would have been no fix: a ViewModel declared at module
level before the instance existed would simply never bind, silently.

Found by starting `@lankajs/host` under a resolver for the first time.
