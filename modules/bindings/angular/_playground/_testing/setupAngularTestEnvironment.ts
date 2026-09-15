import "zone.js";
import "zone.js/testing";
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
 * `zone.js` is imported even though the suite runs zoneless. Angular's testing
 * package still reaches for the zone patches at load; zoneless is a change
 * detection strategy, not an absence of that dependency, and
 * `provideZonelessChangeDetection` in the suite is what actually selects it.
 */
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
	teardown: { destroyAfterEach: false },
});
