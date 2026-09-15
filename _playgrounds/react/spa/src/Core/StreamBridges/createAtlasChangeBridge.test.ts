import { createLankaEventRecorder, resetLanka } from "@lankajs/tool-testing";
import { createLankaStreamTriggerContext } from "lanka/stream";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { beforeEach, describe, expect, it } from "vitest";
import { createAtlasChangeBridge } from "./createAtlasChangeBridge";
import type { ILankaServerEventTransport } from "lanka/stream";

/** A transport with no wire under it: the frames are pushed by the test. */
const fakeStream = () => {
	const listeners = new Map<string, ((payload: Record<string, unknown>) => void)[]>();
	const reconnects: (() => void)[] = [];

	return {
		push: (type: string, payload: Record<string, unknown>) => {
			for (const listener of listeners.get(type) ?? []) listener(payload);
		},
		reconnect: () => {
			for (const listener of reconnects) listener();
		},
		transport: {
			isSupported: () => true,
			connect: () => undefined,
			disconnect: () => undefined,
			on: (type: string, listener: (payload: Record<string, unknown>) => void) => {
				listeners.set(type, [...(listeners.get(type) ?? []), listener]);

				return () => undefined;
			},
			onReconnect: (listener: () => void) => {
				reconnects.push(listener);

				return () => undefined;
			},
		} as unknown as ILankaServerEventTransport,
	};
};

const attached = () => {
	const stream = fakeStream();
	const trigger = createLankaStreamTriggerContext();
	// Built, then REGISTERED. A bridge that subscribed in its constructor could
	// not be disposed, which is the other half of what a bridge is for — so the
	// plugin builds it and calls `register()`, and a test does the same.
	createAtlasChangeBridge()(stream.transport, trigger).register();

	return { ...stream, trigger };
};

describe("createAtlasChangeBridge", () => {
	beforeEach(() => {
		resetLanka();
		// A scenario reaches the bus only once the layer has registered its event
		// type. Without this the trigger is dropped, silently — which is the same
		// order every application keeps and the reason bootstrap exists at all.
		lankaScenarioBootstrap.bootstrap();
	});

	it("turns a server event into the fact the application already has a name for", () => {
		const events = createLankaEventRecorder();
		const bridge = attached();

		bridge.push("mission.completed", { id: "m-2", mission: { id: "m-2", status: "done" } });

		expect(events.count("mission.completed")).toBe(1);
		events.stop();
	});

	it("carries the mission when the server sent one", () => {
		const events = createLankaEventRecorder();
		const bridge = attached();

		bridge.push("mission.assigned", { id: "m-3", crewId: "c-2", mission: { id: "m-3" } });

		expect(events.of<{ crewId: string }>("mission.assigned")[0].crewId).toBe("c-2");
		events.stop();
	});

	it("copes with an event that carried no mission at all", () => {
		// A backend that sends only an id is not a broken one, and losing every
		// event from it would be a silent failure rather than a loud one.
		const events = createLankaEventRecorder();
		const bridge = attached();

		bridge.push("mission.completed", { id: "m-2" });

		expect(events.of<{ mission?: unknown }>("mission.completed")[0].mission).toBeUndefined();
		events.stop();
	});

	it("announces a GAP rather than calling a screen, when the link comes back", () => {
		// A bridge that called `missionsVM.refresh()` would be a stream package
		// knowing a screen's name, and every new screen that needs to catch up
		// would be an edit to the bridge.
		const events = createLankaEventRecorder();
		const bridge = attached();

		bridge.reconnect();

		expect(events.of<{ wire: string }>("stream.reconnected")).toEqual([{ wire: "events" }]);
		events.stop();
	});

	it("marks a handler as coming FROM OUTSIDE while it runs", () => {
		// Without the marker a handler cannot tell its own change from a
		// stranger's: somebody presses a button, then receives the server event
		// about that button, and the screen notifies them about their own action.
		const bridge = attached();
		let insideHandler: boolean | null = null;

		bridge.transport.on("mission.completed", () => {
			insideHandler = bridge.trigger.isActive();
		});
		bridge.push("mission.completed", { id: "m-2" });

		expect(bridge.trigger.isActive()).toBe(false);
		expect(insideHandler).not.toBeNull();
	});
});
