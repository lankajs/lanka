import { createLanka } from "lanka";
import { lankaDevtools } from "../../src/index";
import { renderLankaDevtoolsPanel } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { useTheApp } from "../use-the-app/useTheApp";
import type { IPlaygroundInspected } from "../_interfaces/IPlaygroundInspected";

/**
 * An application being watched: a scenario fires, the log writes, requests come
 * and go, and the inspector is the only thing that sees all three.
 *
 * The property that matters most is the one a unit test cannot show: a DISABLED
 * inspector accumulates nothing. Always-on history is a leak with a user
 * interface — it looks like diagnostics and behaves as slow memory growth,
 * visible only in a long session, which is why `enabled` is a parameter here.
 */
export const startPlaygroundInspected = (enabled: boolean): IPlaygroundInspected => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	// The inspector catches what the logger WRITES. A silent logger has nothing
	// to collect, so an application debugging itself turns the log on first.
	lanka.setConfig({
		flags: { loggerEnabled: true, loggerViewModel: true, isDevelopment: true },
	});

	const devtools = lankaDevtools({ enabled });
	lanka.use(devtools);

	return {
		lanka,
		devtools,
		useTheApp: () => useTheApp(lanka),
		// What a developer actually opens. It answers `undefined` outside
		// development and off a document, so an application may call it
		// unconditionally and ship nothing.
		showPanel: () => renderLankaDevtoolsPanel(() => devtools.getSnapshot()),
	};
};
