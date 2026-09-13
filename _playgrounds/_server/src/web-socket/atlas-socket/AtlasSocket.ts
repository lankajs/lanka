import { readAtlasSocketFrames } from "../read-atlas-socket-frames/readAtlasSocketFrames";
import { writeAtlasSocketFrame } from "../write-atlas-socket-frame/writeAtlasSocketFrame";
import type { Duplex } from "node:stream";

const TEXT = 1;
const CLOSE = 8;
const PING = 9;
const PONG = 10;

/** Called for every text frame that parsed as JSON. */
export type TAtlasSocketListener = (message: Record<string, unknown>) => void;

/**
 * One open socket, with the protocol's own chores already done.
 *
 * The chores are the reason this is a class and not a callback on the raw
 * stream: a ping that is not answered with a pong makes a client decide the link
 * is half-open and reconnect, a close that is not echoed leaves a socket in
 * `CLOSING` until a timeout, and a text frame that is not valid JSON must be
 * dropped rather than crash the process. None of the three is what the board or
 * the subscription transport above it is about.
 */
export class AtlasSocket {
	private readonly socket: Duplex;
	private readonly listeners = new Set<TAtlasSocketListener>();
	private readonly closers = new Set<() => void>();
	/* `ArrayBufferLike` because a subarray of an incoming chunk is not
	 * necessarily backed by a plain ArrayBuffer, and narrowing here would make
	 * every leftover a copy. */
	private pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
	private open = true;

	public constructor(socket: Duplex) {
		this.socket = socket;
		socket.on("data", (chunk: Buffer) => this.take(chunk));
		socket.on("close", () => this.finish());
		socket.on("error", () => this.finish());
	}

	/** Sends one JSON message. Silently does nothing once the socket is gone. */
	public send(message: unknown): void {
		if (!this.open) return;

		this.socket.write(
			writeAtlasSocketFrame(TEXT, Buffer.from(JSON.stringify(message), "utf8")),
		);
	}

	/** Subscribes to incoming messages. Answers the way to stop. */
	public listen(listener: TAtlasSocketListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	/** Notified once, when the socket is gone for any reason. */
	public onClose(listener: () => void): void {
		this.closers.add(listener);
	}

	public close(): void {
		if (!this.open) return;

		this.socket.write(writeAtlasSocketFrame(CLOSE, Buffer.alloc(0)));
		this.socket.end();
		this.finish();
	}

	private take(chunk: Buffer): void {
		const { frames, rest } = readAtlasSocketFrames(Buffer.concat([this.pending, chunk]));
		this.pending = rest;

		for (const frame of frames) this.handle(frame.opcode, frame.payload);
	}

	private handle(opcode: number, payload: Buffer): void {
		if (opcode === CLOSE) return this.close();
		if (opcode === PING) {
			this.socket.write(writeAtlasSocketFrame(PONG, payload));
			return;
		}
		if (opcode !== TEXT) return;

		const message = this.parse(payload);
		// A copy: a listener may unsubscribe itself on the frame it just received.
		if (message) for (const listener of [...this.listeners]) listener(message);
	}

	/**
	 * Reads a text frame as a JSON object, or answers nothing.
	 *
	 * Dropped rather than refused: a frame this server does not understand is the
	 * other end's business, and a socket that dies on one is a socket that dies
	 * the first time somebody adds a keep-alive.
	 */
	private parse(payload: Buffer): Record<string, unknown> | null {
		try {
			const parsed: unknown = JSON.parse(payload.toString("utf8"));

			return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}

	private finish(): void {
		if (!this.open) return;

		this.open = false;
		this.listeners.clear();
		for (const closer of [...this.closers]) closer();
		this.closers.clear();
	}
}
