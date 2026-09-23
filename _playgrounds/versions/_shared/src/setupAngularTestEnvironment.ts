// JIT: the scenes declare components by calling `Component({...})(class)`, and
// the compiler must load before the first one — whichever Angular this is.
import "@angular/compiler";
import { getTestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
	teardown: { destroyAfterEach: false },
});
