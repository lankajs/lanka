import type { ILankaGraphqlSocketEvents, ILankaGraphqlSubscriptionSocket } from "../../src/index";

/**
 * The subscription endpoint, as far as this application can tell.
 *
 * A socket rather than a `WebSocket`: the transport takes an `openSocket` seam
 * for exactly this — a native bridge, a socket the application already had, or a
 * test that wants to read the `graphql-ws` handshake frame by frame. Everything
 * above it, the protocol included, is the package's own code running for real.
 */
export class PlaygroundGraphqlSocket implements ILankaGraphqlSubscriptionSocket {
	public static instances: PlaygroundGraphqlSocket[] = [];

	public closed = false;
	/** Every frame the application sent, parsed. */
	public readonly sent: Record<string, unknown>[] = [];

	public readonly url: string;

	private readonly events: ILankaGraphqlSocketEvents;

	public constructor(url: string, events: ILankaGraphqlSocketEvents) {
		this.url = url;
		this.events = events;
		PlaygroundGraphqlSocket.instances.push(this);
	}

	public send(frame: string): void {
		this.sent.push(JSON.parse(frame) as Record<string, unknown>);
	}

	public close(): void {
		this.closed = true;
	}

	/** The transport layer connected. */
	public accept(): void {
		this.events.onOpen();
	}

	/** The server answers the handshake. */
	public acknowledge(): void {
		this.events.onFrame(JSON.stringify({ type: "connection_ack" }));
	}

	/** A frame arrives from the server. */
	public deliver(frame: Record<string, unknown>): void {
		this.events.onFrame(JSON.stringify(frame));
	}

	/** Something that is not a frame at all. */
	public deliverRaw(raw: unknown): void {
		this.events.onFrame(raw);
	}

	/** The socket went away. */
	public drop(): void {
		this.events.onClosed();
	}

	/** The frames of one type the application sent. */
	public framesOf(type: string): Record<string, unknown>[] {
		return this.sent.filter((frame) => frame.type === type);
	}

	/** The id the application used to subscribe, in order. */
	public subscriptionIds(): string[] {
		return this.framesOf("subscribe").map((frame) => String(frame.id));
	}
}
