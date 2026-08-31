import { describe, expect, it } from "vitest";
import { defineLankaRole } from "./defineLankaRole";

/**
 * The bridge between the two styles of one role.
 *
 * The subject is not the helper's five lines but the promise they carry: both
 * styles are the SAME class, so a behaviour cannot exist in one and not the
 * other.
 */
abstract class ACounter {
	protected count = 0;

	protected increment(by: number): number {
		this.count += by;
		return this.count;
	}

	public read(): number {
		return this.count;
	}
}

interface ICounterContext {
	increment: (by: number) => number;
	read: () => number;
}

/** The opener: written here because `protected` is readable only from inside. */
class CounterBridge extends ACounter {
	public open(): { instance: ACounter; context: ICounterContext } {
		return {
			instance: this,
			context: {
				increment: (by) => this.increment(by),
				read: () => this.read(),
			},
		};
	}
}

const createCounter = defineLankaRole<{ start?: number }, ACounter, ICounterContext>((config) => {
	const bridge = new CounterBridge();
	if (config.start) bridge.open().context.increment(config.start);
	return bridge.open();
});

describe("one role, two styles", () => {
	it("answers the instance when no hooks were given", () => {
		const counter = createCounter({});

		expect(counter.read()).toBe(0);
	});

	it("answers what the hooks returned when they were", () => {
		const counter = createCounter({
			build: ({ increment, read }) => ({
				addTwice: (by: number) => {
					increment(by);
					return increment(by);
				},
				total: read,
			}),
		});

		expect(counter.addTwice(3)).toBe(6);
		expect(counter.total()).toBe(6);
	});

	it("hands the functional style the same object the class style holds", () => {
		let seen = 0;
		const counter = createCounter({
			start: 5,
			build: ({ read }) => {
				seen = read();
				return { seen };
			},
		});

		// Not a copy and not a second implementation: the context reads the state
		// of the very instance the class style would have subclassed.
		expect(counter.seen).toBe(5);
		expect(seen).toBe(5);
	});

	it("carries the class's own behaviour into the functional style", () => {
		const viaClass = new (class extends ACounter {
			public twice(by: number): number {
				this.increment(by);
				return this.increment(by);
			}
		})();

		const viaFactory = createCounter({
			build: ({ increment }) => ({
				twice: (by: number) => {
					increment(by);
					return increment(by);
				},
			}),
		});

		// The property parity is about: the same steps produce the same answer,
		// because there is one implementation underneath.
		expect(viaFactory.twice(4)).toBe(viaClass.twice(4));
	});
});
