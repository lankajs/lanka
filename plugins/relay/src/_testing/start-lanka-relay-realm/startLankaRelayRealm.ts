import { createLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaRelayBroadcastChannelTransport } from "../../_factories/create-lanka-relay-broadcast-channel-transport/createLankaRelayBroadcastChannelTransport";
import { lankaRelay } from "../../lanka-relay/lankaRelay";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaRelayOptions } from "../../lanka-relay/lankaRelay";

/** What the test tells the other realm to do. */
export type TLankaRelayRealmCommand =
	| {
			readonly do: "start";
			readonly options: Omit<ILankaRelayOptions, "transport">;
			readonly listen: readonly string[];
	  }
	| { readonly do: "dispatch"; readonly eventType: string; readonly data: unknown };

/** What the other realm tells the test. */
export type TLankaRelayRealmReport =
	{ readonly started: true } | { readonly heard: string; readonly data: unknown };

/** The two ends of a worker's port this harness uses — `parentPort`, in a worker thread. */
interface ILankaRelayRealmPort {
	on: (event: "message", listener: (command: TLankaRelayRealmCommand) => void) => void;
	postMessage: (report: TLankaRelayRealmReport) => void;
}

/**
 * The other realm's half of `lankaRelay.realms.test.ts`: one application, in a
 * worker thread, with its own global object and so its own page registry.
 *
 * It is driven by messages because a realm is reached no other way — which is
 * the point. It installs the relay with the transport a consumer would, and
 * reports every delivery it hears on the event types it was told to listen to.
 */
export const startLankaRelayRealm = (port: ILankaRelayRealmPort): void => {
	let lanka: ILankaInstance | null = null;

	port.on("message", (command) => {
		if (command.do === "dispatch") {
			lanka?.eventBus.dispatch(command.eventType, command.data);
			return;
		}

		lanka = createLanka({ host: lankaTestHost });
		for (const eventType of command.listen) {
			lanka.eventBus.subscribe(eventType, (data: unknown) => {
				port.postMessage({ heard: eventType, data });
			});
		}
		lanka.use(
			lankaRelay({
				...command.options,
				transport: createLankaRelayBroadcastChannelTransport(),
			}),
		);
		port.postMessage({ started: true });
	});
};
