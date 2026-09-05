import { lankaEventBus } from "lanka/scenario";
import type { ILankaInstance } from "lanka/bootstrap";
import type { TLankaEventBusMiddleware } from "lanka/scenario";

/** One event as it crossed the bus. */
export interface ILankaRecordedEvent {
	at: number;
	eventType: string;
	data: unknown;
}

export interface ILankaEventRecorderConfig {
	/** Whose bus to watch. The active instance by default. */
	lanka?: ILankaInstance;
	/** Clock, so a test can move time. */
	clock?: () => number;
}

export interface ILankaWaitForEventOptions {
	/** How long to wait before failing. Defaults to 1000. */
	timeoutMs?: number;
}

export interface ILankaEventRecorder {
	/** Every event that crossed the bus since the recorder started. */
	readonly all: readonly ILankaRecordedEvent[];
	/** The payloads of one event type, in order. */
	readonly of: <TData = unknown>(eventType: string) => readonly TData[];
	/** How many times one event type crossed. */
	readonly count: (eventType: string) => number;
	/** The payload of one event type, waiting for it if it has not happened yet. */
	readonly waitFor: <TData = unknown>(
		eventType: string,
		options?: ILankaWaitForEventOptions,
	) => Promise<TData>;
	/** Forget everything recorded so far. The recorder keeps watching. */
	readonly clear: () => void;
	/** Stop watching. */
	readonly stop: () => void;
}

const DEFAULT_TIMEOUT_MS = 1000;

/**
 * Everything that crossed the bus, so a test can assert on it.
 *
 * ## Why the kit needs this at all
 *
 * The scenario layer is what a lanka application is arranged around, and the
 * kit could only double a scenario the test itself injected. "Did doing this
 * make that fire" — the question the whole layer exists to answer — had no
 * answer here, so every consumer wrote a middleware by hand and asserted on a
 * closure they also wrote.
 *
 * ## It observes and does not decide
 *
 * The middleware answers `"pass"` unconditionally, for the reason the inspector
 * does: a recorder able to stop delivery would make watching a test change what
 * the test is watching.
 *
 * ## `waitFor` REJECTS on its deadline
 *
 * A helper that resolves late and silently is how a suite acquires tests that
 * pass without the thing having happened. The rejection names the event type,
 * because the failure a developer sees is otherwise "timed out" with no subject.
 *
 * An event that ALREADY crossed resolves immediately, with the most recent
 * payload. Waiting for something that has happened is the classic race, and a
 * test written against it fails by timing rather than by behaviour.
 */
export const createLankaEventRecorder = (
	config: ILankaEventRecorderConfig = {},
): ILankaEventRecorder => {
	const bus = config.lanka?.eventBus ?? lankaEventBus;
	const clock = config.clock ?? (() => Date.now());
	const recorded: ILankaRecordedEvent[] = [];
	const waiting = new Set<(event: ILankaRecordedEvent) => void>();

	const middleware: TLankaEventBusMiddleware<unknown> = (eventType, data) => {
		const event = { at: clock(), eventType, data };
		recorded.push(event);
		for (const notify of [...waiting]) notify(event);

		return "pass";
	};

	bus.addMiddleware(middleware);

	const payloadsOf = (eventType: string): unknown[] =>
		recorded.filter((event) => event.eventType === eventType).map((event) => event.data);

	return {
		all: recorded,
		of: <TData>(eventType: string) => payloadsOf(eventType) as TData[],
		count: (eventType: string) => payloadsOf(eventType).length,
		waitFor: <TData>(eventType: string, options: ILankaWaitForEventOptions = {}) =>
			waitForEvent<TData>({
				eventType,
				timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				alreadyRecorded: payloadsOf(eventType),
				waiting,
			}),
		clear: () => {
			recorded.length = 0;
		},
		stop: () => {
			bus.removeMiddleware(middleware);
			waiting.clear();
		},
	};
};

/** The wait itself, kept out of the factory so the factory reads as its surface. */
const waitForEvent = <TData>(request: {
	eventType: string;
	timeoutMs: number;
	alreadyRecorded: readonly unknown[];
	waiting: Set<(event: ILankaRecordedEvent) => void>;
}): Promise<TData> => {
	const seen = request.alreadyRecorded.at(-1);
	if (request.alreadyRecorded.length > 0) return Promise.resolve(seen as TData);

	return new Promise<TData>((resolve, reject) => {
		const settle = (): void => {
			clearTimeout(timer);
			request.waiting.delete(listen);
		};

		const listen = (event: ILankaRecordedEvent): void => {
			if (event.eventType !== request.eventType) return;
			settle();
			resolve(event.data as TData);
		};

		const timer = setTimeout(() => {
			settle();
			reject(
				new Error(
					`Waited ${String(request.timeoutMs)}ms for event "${request.eventType}" and it ` +
						"never crossed the bus.",
				),
			);
		}, request.timeoutMs);

		request.waiting.add(listen);
	});
};
