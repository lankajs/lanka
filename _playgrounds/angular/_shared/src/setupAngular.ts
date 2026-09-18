import "@angular/compiler";
import "@analogjs/vite-plugin-angular/setup-vitest";

import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { getTestBed } from "@angular/core/testing";

/**
 * Angular's testing environment, initialised once for this process.
 *
 * The one framework here that cannot render until it is told how. React, Vue,
 * Svelte and Solid each expose a render function that needs nothing first;
 * Angular's `TestBed` is a compiler and an injector, and it has to be given a
 * platform before any of it works.
 *
 * The two side-effect imports come first and in this order. `@angular/compiler`
 * is the JIT compiler: a template compiled at test time needs it present BEFORE
 * anything asks for an injectable, and its absence reports as "PlatformLocation
 * needs to be compiled using the JIT compiler" — a message that names neither
 * this file nor the import it wants. The plugin's `setup-vitest` installs the
 * Zone-free async hooks the compiler emits into.
 */
/*
 * Only where there IS a document.
 *
 * A file that declares `@vitest-environment node` renders to a STRING through
 * `@angular/platform-server`, which brings its own DOM and its own platform.
 * Registering the browser testing platform there wins over the server one and
 * the render fails on a global `document` that a node process does not have.
 */
if (typeof document !== "undefined") {
	getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
}
