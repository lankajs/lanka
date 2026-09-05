import { ALankaScenario } from "lanka/scenario";
import type { IPlaygroundProfile } from "../_interfaces/IPlaygroundProfile";

/** The fact the rest of the application waits for. */
export class PlaygroundProfileLoaded extends ALankaScenario<IPlaygroundProfile> {
	readonly name = "PlaygroundProfileLoaded";
	readonly eventType = "playground:profile-loaded";
	readonly dataTypeName = "IPlaygroundProfile";
}

/** The single instance the application triggers. */
export const playgroundProfileLoaded = new PlaygroundProfileLoaded();
