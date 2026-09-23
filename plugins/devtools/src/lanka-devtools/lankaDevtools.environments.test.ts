// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createLanka } from "lanka";
import { setLankaScopeResolver } from "lanka/internal";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaDevtools } from "./lankaDevtools";
import { renderLankaDevtoolsPanel } from "../panel/renderLankaDevtoolsPanel";
import { createLankaDevtoolsPanelView } from "../panel/_internal/create-lanka-devtools-panel-view/createLankaDevtoolsPanelView";
import type { ILankaInstance } from "lanka";

/**
 * The inspector where there is no page: a Node process, a test runner, a React
 * Native device.
 *
 * Only the panel draws, so only the panel needs a document; the collector reads
 * the bus, the logger and the wire, which every environment has. What a server
 * adds is the one thing the inspector must refuse: a request scope, where the
 * logger it attaches to is the PROCESS's and every concurrent request's lines
 * would land in one request's history.
 */

const instances: ILankaInstance[] = [];

const application = (): ILankaInstance => {
	const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
	instances.push(lanka);
	return lanka;
};

afterEach(() => {
	for (const lanka of instances.splice(0)) lanka.dispose();
	setLankaScopeResolver(null);
});

describe("the inspector without a page", () => {
	it("records what the bus delivered in a process with no DOM", () => {
		const lanka = application();
		const devtools = lankaDevtools({ enabled: true });
		lanka.use(devtools);

		lanka.eventBus.dispatch("CART_CHANGED", { items: 2 });

		expect(devtools.getSnapshot().events.map((event) => event.eventType)).toContain(
			"CART_CHANGED",
		);
	});

	it("draws no panel where there is no document", () => {
		const devtools = lankaDevtools({ enabled: true });

		expect(renderLankaDevtoolsPanel(devtools.getSnapshot)).toBeUndefined();
	});

	it("says the panel's view needs a DOM, rather than failing on its first element", () => {
		expect(() =>
			createLankaDevtoolsPanelView({
				getSnapshot: lankaDevtools().getSnapshot,
				tab: "events",
				collapsed: false,
			}),
		).toThrowError(/needs a DOM/);
	});

	it("refuses to install an enabled inspector inside a server's request scope", () => {
		setLankaScopeResolver(() => ({}));
		const lanka = application();

		expect(() => lanka.use(lankaDevtools({ enabled: true }))).toThrowError(/server/i);
	});

	it("installs a disabled one there, since it collects nothing", () => {
		// A production build that ships the plugin disabled must still start on
		// a server: a disabled inspector attaches to nothing.
		setLankaScopeResolver(() => ({}));
		const lanka = application();

		expect(() => lanka.use(lankaDevtools({ enabled: false }))).not.toThrow();
	});
});
