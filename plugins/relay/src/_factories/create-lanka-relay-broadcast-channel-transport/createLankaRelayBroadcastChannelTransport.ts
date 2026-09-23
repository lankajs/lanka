import { lankaLogger } from "lanka/logger";
import type { ILankaRelayTransport } from "../../_interfaces/ILankaRelayTransport";

/**
 * The medium's name. One for every relay channel: the channel travels in each
 * frame, so two channels share a medium and never hear each other.
 */
const MEDIUM = "lanka.relay";

/**
 * A transport over `BroadcastChannel`: every tab, iframe and worker of one
 * ORIGIN, with nothing to configure.
 *
 * ```ts
 * lanka.use(lankaRelay({ channel: "shop", send: ["CART_CHANGED"], transport: createLankaRelayBroadcastChannelTransport() }));
 * ```
 *
 * ## Why this one, and why only this one
 *
 * `BroadcastChannel` reaches everyone on the medium, keeps each sender's order,
 * and is bounded by the origin — the three things `ILankaRelayTransport` asks
 * for, with no decision left to a default. `postMessage` needs a target origin,
 * and choosing one is a security decision a default would get wrong; an
 * application that needs it implements the two members itself.
 *
 * One medium per transport, opened on first use and closed when its last
 * subscriber leaves. In a cross-site iframe the browser partitions it by the
 * top-level site, so a frame embedded elsewhere hears only its own kind.
 *
 * ## Where it cannot run
 *
 * React Native has no `BroadcastChannel`, nor Safari before 15.4. Asked for one
 * there, this throws at creation rather than returning a transport that delivers
 * nothing: the application asked for other realms explicitly, and silence would
 * look exactly like realms that have nothing to say.
 */
export const createLankaRelayBroadcastChannelTransport = (): ILankaRelayTransport => {
	if (typeof BroadcastChannel === "undefined") {
		throw new Error(
			"createLankaRelayBroadcastChannelTransport() needs BroadcastChannel, and this environment " +
				"has none (React Native; Safari before 15.4). Implement ILankaRelayTransport " +
				"over the medium it does have.",
		);
	}

	const receivers = new Set<(message: unknown) => void>();
	let medium: BroadcastChannel | null = null;

	const open = (): BroadcastChannel => {
		if (medium) return medium;

		medium = new BroadcastChannel(MEDIUM);
		medium.onmessage = (event: MessageEvent) => {
			deliver(receivers, event.data);
		};
		return medium;
	};

	return Object.freeze<ILankaRelayTransport>({
		post(message) {
			open().postMessage(message);
		},
		subscribe(receive) {
			receivers.add(receive);
			open();

			return () => {
				receivers.delete(receive);
				if (receivers.size > 0 || !medium) return;
				medium.close();
				medium = null;
			};
		},
	});
};

/** One message to every receiver; one receiver failing does not stop the rest. */
const deliver = (receivers: ReadonlySet<(message: unknown) => void>, message: unknown): void => {
	for (const receive of [...receivers]) {
		try {
			receive(message);
		} catch (error) {
			lankaLogger.printScenarioLog("Relay transport could not deliver a message:", error);
		}
	}
};
