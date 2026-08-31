import { ALankaScenario } from "lanka/scenario";

/**
 * What the rest of the application understands: a message arrived.
 *
 * The scenario is declared by the APPLICATION, not by this package. A bridge
 * translates a wire event into it; nothing above the bridge knows a stream
 * exists, which is the whole point of the seam.
 */
export class PlaygroundMessageArrived extends ALankaScenario<{ text: string }> {
	readonly name = "PlaygroundMessageArrived";
	readonly eventType = "playground:message-arrived";
	readonly dataTypeName = "IPlaygroundMessageArrived";
}

/** The single instance the bridge triggers and screens subscribe to. */
export const playgroundMessageArrived = new PlaygroundMessageArrived();
