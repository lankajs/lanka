import { ALankaScenario } from "lanka/scenario";

/**
 * A scenario the application declares and never fires.
 *
 * The case a developer opens the inspector for — "why does nothing happen" — and
 * the one a list of what DID happen cannot show at all.
 */
export class PlaygroundCheckoutBlocked extends ALankaScenario<{ reason: string }> {
	readonly name = "PlaygroundCheckoutBlocked";
	readonly eventType = "playground:checkout-blocked";
	readonly dataTypeName = "IPlaygroundCheckoutBlocked";
}

/** The single instance the application would trigger, if it ever got there. */
export const playgroundCheckoutBlocked = new PlaygroundCheckoutBlocked();
