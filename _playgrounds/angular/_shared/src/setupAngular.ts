import "@angular/compiler";

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
 * The side-effect import comes first. `@angular/compiler` is the JIT compiler:
 * a template compiled at test time needs it present BEFORE anything asks for an
 * injectable, and its absence reports as "PlatformLocation needs to be compiled
 * using the JIT compiler" — a message that names neither this file nor the
 * import it wants.
 *
 * ## What is NOT imported, and why it was
 *
 * `@analogjs/vite-plugin-angular/setup-vitest` was here, and it is four zone.js
 * imports followed by a patch that wraps Vitest's `describe` and `test` in a
 * ProxyZone. That exists so `fakeAsync` and `waitForAsync` work; nothing in this
 * ecosystem uses either, and Angular answered the contradiction on every run —
 * NG0914, zoneless change detection while zone.js is still loading. A warning on
 * every run is a warning nobody reads, including the next real one.
 *
 * What replaced it is nothing at all: `provideZonelessChangeDetection` in the
 * suite, `await fixture.whenStable()` where a test has to wait, and
 * `useAtlasMissions.test.ts` asserting `globalThis.Zone` is undefined so this
 * cannot come back unnoticed.
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
