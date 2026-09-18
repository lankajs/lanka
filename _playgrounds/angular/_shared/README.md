# @lanka-playgrounds/angular-shared

What the Angular applications share and no other ecosystem can use.

Read [`../../README.md`](../../README.md) first.

## What is in here, and what is deliberately not

Everything here is the **View** layer, the same line every other ecosystem draws:
a view renders and reads its ViewModel; a ViewModel owns state and actions and
knows nothing about a renderer.

So this package holds a read path, a text rule and one injection token. It holds
no ViewModel at all — those live in [`../../_shared`](../../_shared), have no
Angular in them, and are read unchanged by React, by Vue, by Svelte, by Solid, by
a server and by a process with no screen.

## A token, where every other ecosystem passes a prop

`ATLAS_MISSIONS_VM` is the one thing here that has no counterpart elsewhere.
Every other framework has ONE way to hand a component something; Angular has two,
and they mean different things. An `input` is DATA that a parent owns and
changes. A provider is a DEPENDENCY that exists for the lifetime of an injector.

A ViewModel is the second: its identity never changes for the life of a screen,
and the same instance is read by several sibling components.

The choice was not a preference. `input.required` cannot be read in a field
initialiser — the value arrives after construction, and Angular answers NG0950 —
but `useLankaVM` has to run in an injection context, because its subscription is
torn down by `DestroyRef`. A screen taking its ViewModel as a required input has
nowhere left to read it. `inject()` in a field initialiser is both at once.

## `formatAtlasMissionLine` is a function, not a pipe

A pipe is a class with a decorator and an import into every template that uses
it. This is a string rule, called by a server renderer and a test as well as by a
template, and none of those want an injector to call it.

## `setupAngular.ts`, and why this ecosystem needs one

Angular is the only framework here that cannot render until it is told how.
React, Vue, Svelte and Solid each expose a render function that needs nothing
first; `TestBed` is a compiler and an injector, and it has to be given a platform.

Two side-effect imports come first and in this order. `@angular/compiler` is the
JIT compiler — a template compiled at test time needs it present BEFORE anything
asks for an injectable, and its absence reports as "PlatformLocation needs to be
compiled using the JIT compiler", a message that names neither the file nor the
import it wants. The plugin's `setup-vitest` installs the async hooks after it.

The initialisation is skipped where there is no `document`: a file that declares
`@vitest-environment node` renders to a STRING through `@angular/platform-server`,
which brings its own DOM and its own platform, and registering the browser one
there wins over it.
