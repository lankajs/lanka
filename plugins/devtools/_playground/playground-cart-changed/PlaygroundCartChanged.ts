import { ALankaScenario } from "lanka/scenario";

/** Something the inspector should see happen. */
export class PlaygroundCartChanged extends ALankaScenario<{ items: number }> {
	readonly name = "PlaygroundCartChanged";
	readonly eventType = "playground:cart-changed";
	readonly dataTypeName = "IPlaygroundCartChanged";
}

/** The single instance the application triggers. */
export const playgroundCartChanged = new PlaygroundCartChanged();
