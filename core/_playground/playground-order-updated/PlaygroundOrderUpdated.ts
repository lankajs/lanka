import { ALankaScenario } from "../../src/scenario/index";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

/**
 * The fact the order screens announce to each other: an order was saved.
 *
 * It carries the saved order, in the DOMAIN shape the server answered with, so
 * a subscriber applies it rather than asking the server again. It begins in a
 * ViewModel action and ends in ViewModel handlers — never in a form, never in
 * the cache: a form that subscribed would be a second ViewModel without a name,
 * and a cache event that triggered it would loop through its own invalidation.
 */
export class PlaygroundOrderUpdated extends ALankaScenario<{ order: IPlaygroundOrder }> {
	readonly name = "PlaygroundOrderUpdated";
	readonly eventType = "playground:order-updated";
	readonly dataTypeName = "IPlaygroundOrderUpdated";
}

/** The single instance every screen triggers and subscribes to. */
export const playgroundOrderUpdated = new PlaygroundOrderUpdated();
