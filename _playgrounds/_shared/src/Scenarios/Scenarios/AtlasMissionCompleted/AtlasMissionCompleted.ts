import { ALankaScenario } from "lanka/scenario";
import type { TAtlasMissionCompletedEventData } from "../../ScenarioTypes/TAtlasMissionCompletedEventData";

/**
 * A fact, named in the past tense: this mission WAS completed.
 *
 * `AtlasMissionCompleted`, never `CompleteMission`. The second invites a
 * subscriber to do the completing; the first states what happened, which is what
 * lets three screens react differently without knowing about each other.
 *
 * Written as a class while its siblings are written by calling — the same two
 * styles the rest of the framework offers, over one implementation.
 */
export class AtlasMissionCompleted extends ALankaScenario<TAtlasMissionCompletedEventData> {
	public readonly name = "AtlasMissionCompleted";
	public readonly eventType = "mission.completed";
	public readonly dataTypeName = "TAtlasMissionCompletedEventData";
}

/**
 * The one instance, beside its class.
 *
 * A second instance is a second event nobody listens to — silence rather than an
 * error, which is the worst way for this to go wrong.
 */
export const atlasMissionCompleted = new AtlasMissionCompleted();
