import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";
import type { ILankaStreamTriggerContext } from "../../_factories/create-lanka-stream-trigger-context/createLankaStreamTriggerContext";
import type { TLankaStreamEventCallback } from "../../_types/TLankaStreamEventCallback";

/**
 * A server-event -> application-scenario bridge.
 *
 * It KNOWS about the event stream and the "came from outside" marker, and knows
 * no concrete event type: which bridges exist is the application's domain.
 *
 * ## Inbound only, even where the wire is two-way
 *
 * A WebSocket can send and a bridge cannot, deliberately. A bridge translates
 * what arrived into a fact the rest of the application already understands, and
 * a bridge that also sends becomes the one object that both starts and finishes
 * a conversation — untestable without a socket, and the place every screen
 * eventually reaches into. Sending belongs to whatever already owns the action:
 * a gateway holding the channel, or a ViewModel calling it.
 *
 * ## Why subscriptions are collected rather than forgotten
 *
 * A bridge that subscribes in its constructor and never unsubscribes cannot
 * notice the problem while it lives exactly as long as the application. In a
 * package it is different — the plugin is removed, the instance is disposed, a
 * dev server reloads the module — and a leftover subscription keeps triggering a
 * dead instance's scenarios.
 */
export abstract class ALankaStreamBridge {
	private readonly unsubscribes: (() => void)[] = [];

	protected readonly stream: ILankaServerEventTransport;
	protected readonly trigger: ILankaStreamTriggerContext;

	// Fields declared explicitly: `erasableSyntaxOnly` forbids parameter
	// properties, the one TypeScript construct that emits code.
	//
	// The constructor is PUBLIC: the class is abstract and cannot be constructed
	// on its own, while `protected` is inherited — and the application's subclass
	// would then be unreachable to the code that creates it.
	public constructor(stream: ILankaServerEventTransport, trigger: ILankaStreamTriggerContext) {
		this.stream = stream;
		this.trigger = trigger;
	}

	/** Subscribes the bridge to its events. Called by the plugin on install. */
	public abstract register(): void;

	/** Removes everything the bridge subscribed to. */
	public dispose(): void {
		for (const unsubscribe of this.unsubscribes) unsubscribe();
		this.unsubscribes.length = 0;
	}

	/**
	 * Subscribes to an event type; the handler runs with the "from outside"
	 * marker.
	 *
	 * The marker is set HERE rather than left to each bridge: a handler that
	 * forgot it is indistinguishable from a user action, and the difference is
	 * silent — the screen simply behaves oddly in a rare case.
	 */
	protected on(eventType: string, handler: TLankaStreamEventCallback): void {
		this.unsubscribes.push(
			this.stream.on(eventType, (payload) => {
				this.trigger.run(() => handler(payload));
			}),
		);
	}

	/** The same for an event with no payload. */
	protected onSignal(eventType: string, handler: () => void): void {
		this.on(eventType, () => handler());
	}

	/** Catch-up for what was missed while disconnected. */
	protected onReconnect(handler: () => void): void {
		this.unsubscribes.push(
			this.stream.onReconnect(() => {
				this.trigger.run(handler);
			}),
		);
	}
}
