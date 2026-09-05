import { createLanka } from "lanka";
import { lankaDevtools, renderLankaDevtoolsPanel } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaFakeTransport } from "@lankajs/tool-testing";
import { PlaygroundCartGateway } from "../playground-cart-gateway/PlaygroundCartGateway";
import { playgroundCheckoutBlocked } from "../playground-checkout-blocked/PlaygroundCheckoutBlocked";
import { useTheApp } from "../use-the-app/useTheApp";
import type { IPlaygroundInspected } from "../_interfaces/IPlaygroundInspected";

export interface IPlaygroundInspectedConfig {
	/**
	 * Whether the inspector collects anything.
	 *
	 * A parameter, because the property that matters most is the one a unit test
	 * cannot show: a DISABLED inspector accumulates nothing. Always-on history is
	 * a leak with a user interface — diagnostics in appearance, memory growth in
	 * fact, visible only in a long session.
	 */
	enabled: boolean;
	/** A global name to reach the inspector by, as a console user would. */
	exposeAs?: string;
	/** Something that refuses an event, so a stop has a name to carry. */
	blockWith?: string;
}

/**
 * An application being watched: a scenario fires, the log writes, a request goes
 * out and comes back, and the inspector is the only thing that sees all of it.
 */
export const startPlaygroundInspected = (
	config: IPlaygroundInspectedConfig,
): IPlaygroundInspected => {
	const lanka = startTheFramework();
	const devtools = lankaDevtools({ enabled: config.enabled, exposeAs: config.exposeAs });
	lanka.use(devtools);

	// AFTER the inspector, which is the order a bootstrap produces and the one in
	// which the inspector's own middleware cannot see this decision.
	if (config.blockWith !== undefined) {
		const reason = config.blockWith;
		lanka.eventBus.addMiddleware(() => ({ stop: reason }));
	}

	// Declared and never fired: the application knows about it, and the register
	// is the only place that shows so.
	lanka.eventBus.registerEvent(playgroundCheckoutBlocked.eventType, {
		dataType: playgroundCheckoutBlocked.dataTypeName,
		usedBy: ["PlaygroundCheckoutScreen"],
	});

	const transport = createLankaFakeTransport({
		routes: [{ match: "/cart", body: { items: 2 }, delayMs: 1 }],
	});
	const app: IPlaygroundInspected = {
		lanka,
		devtools,
		transport,
		cartGateway: new PlaygroundCartGateway(transport),
		useTheApp: () => useTheApp(app),
		// What a developer actually opens. It answers `undefined` outside
		// development and off a document, so an application may call it
		// unconditionally and ship nothing.
		showPanel: (options) =>
			renderLankaDevtoolsPanel(() => devtools.getSnapshot(), {
				subscribe: devtools.subscribe,
				onClear: devtools.clear,
				...options,
			}),
	};

	return app;
};

/**
 * The framework, with the log switched on.
 *
 * The inspector catches what the logger WRITES. A silent logger has nothing to
 * collect, so an application debugging itself turns the log on first.
 */
const startTheFramework = () => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();
	lanka.setConfig({
		flags: { loggerEnabled: true, loggerViewModel: true, isDevelopment: true },
	});

	return lanka;
};
