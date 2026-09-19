import { getTestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";

/**
 * Angular's test environment, initialised once per file.
 *
 * `TestBed` is not a bare container: it compiles a dynamic module, and doing
 * that needs a PLATFORM. Without this it throws reading `ngModule` off `null`,
 * which names nothing a reader can act on — so the setup exists as much for the
 * next person as for the runtime.
 *
 * ## No `zone.js`, which used to be the first two lines here
 *
 * The claim was that Angular's testing package reaches for the zone patches at
 * load. It does not: the suite runs green without them, and with them Angular
 * reported NG0914 on every file — zoneless change detection while zone.js is
 * still loading. Zone.js is what `fakeAsync` and `waitForAsync` need, this
 * playground uses neither, and the conformance suite asserts the global is
 * undefined so the import cannot return unnoticed.
 */
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
	teardown: { destroyAfterEach: false },
});
