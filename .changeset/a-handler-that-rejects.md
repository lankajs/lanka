---
"lanka": patch
---

The event bus catches a handler's rejection, not only its throw

`dispatch` wrapped each subscriber call in try/catch so one broken handler could
not take a dispatch down with it. That promise held only for the handlers that
happened to be synchronous.

A handler is typed `(data) => void`. TypeScript assigns a `Promise<void>` to a
void return position, so `async () => { await refetch(); }` compiles with nothing
to warn about — and "refetch when the stream reconnects" is the ordinary shape of
a scenario handler, not an exotic one. Its rejection settles a microtask after
the loop has finished, where the catch cannot reach it. On node's default an
unhandled rejection ends the PROCESS, and ends it inside whatever code ran next,
so the stack names a file with no connection to the handler that failed.

The returned value is now checked for a `then` and its rejection written to the
scenario log, through the same line a synchronous throw takes. Duck-typed rather
than `instanceof Promise`: the promise need not be this realm's — a jsdom test, a
native module and a bundled polyfill each bring their own — and `instanceof`
would answer false in precisely the environments most likely to need it.

**What the bus deliberately does not do is decide what the failure meant.** A log
line is a diagnostic, not a retry and not a message on a screen. An action called
from a handler still has to own its own failure, because the handler returns
`void` and has nowhere to put one.
