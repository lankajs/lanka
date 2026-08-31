import { createLanka } from "lanka";
import { lankaSse } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { PlaygroundChatBridge } from "../playground-chat-bridge/PlaygroundChatBridge";
import { PlaygroundEventSource } from "../playground-event-source/PlaygroundEventSource";
import type { IPlaygroundChat } from "../_interfaces/IPlaygroundChat";

/** Starts a chat screen fed by server events, the way an application would. */
export const startPlaygroundChat = (): IPlaygroundChat => {
	PlaygroundEventSource.instances = [];
	(globalThis as { EventSource?: unknown }).EventSource = PlaygroundEventSource;

	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	let isActive: () => boolean = () => false;

	const sse = lankaSse({
		path: "/events",
		bridges: ({ sse: transport, trigger }) => {
			isActive = trigger.isActive;
			return [new PlaygroundChatBridge(transport, trigger)];
		},
	});

	lanka.use(sse);

	return {
		lanka,
		signIn: () => sse.sse.connect(),
		isConnected: () => PlaygroundEventSource.instances.length > 0,
		connection() {
			const source = PlaygroundEventSource.instances.at(-1);
			if (!source) throw new Error("the plugin opened no connection");
			return source;
		},
		isFromOutside: () => isActive(),
	};
};
