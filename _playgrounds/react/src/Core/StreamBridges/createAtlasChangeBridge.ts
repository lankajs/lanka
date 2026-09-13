import {
	atlasMissionAssigned,
	atlasMissionCompleted,
	atlasStreamReconnected,
} from "@lanka-playgrounds/_shared";
import { createLankaSseBridge } from "@lankajs/plugin-sse";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/** What the server puts in a mission event. */
interface IAtlasMissionEvent {
	id?: unknown;
	crewId?: unknown;
	mission?: unknown;
}

const missionIn = (payload: IAtlasMissionEvent): IAtlasMission | undefined =>
	typeof payload.mission === "object" && payload.mission !== null
		? (payload.mission as IAtlasMission)
		: undefined;

/**
 * The id the server sent, if it sent one that can be an id.
 *
 * `String(payload.id)` would be the short version and it is the wrong one: over
 * a wire `id` is whatever arrived, and `String({})` is the string
 * `"[object Object]"` — a perfectly valid-looking id that matches no mission and
 * fails no check. An empty string says "the server did not tell us", which is
 * the truth and is a thing a handler can test for.
 */
const idIn = (payload: IAtlasMissionEvent): string =>
	typeof payload.id === "string" ? payload.id : "";

/**
 * Which server events exist, and which of this application's facts each one is.
 *
 * The one thing the SSE package cannot write: it knows no event type, and a
 * convention about naming would be a rule nobody can check.
 *
 * Every handler here goes through `on`, never through a direct subscription —
 * and that is not style. The bridge sets the "from outside" marker, and a
 * handler that forgot it is indistinguishable from a user action. The screen
 * then notifies somebody about their own click, and an optimistic update is
 * rolled back by an event that in fact confirms it.
 */
export const createAtlasChangeBridge = () =>
	createLankaSseBridge(({ on, onReconnect }) => {
		on("mission.completed", (payload) => {
			const event = payload as IAtlasMissionEvent;
			atlasMissionCompleted.trigger({
				id: idIn(event),
				mission: missionIn(event),
			});
		});

		on("mission.assigned", (payload) => {
			const event = payload as IAtlasMissionEvent;
			atlasMissionAssigned.trigger({
				id: idIn(event),
				crewId: typeof event.crewId === "string" ? event.crewId : null,
				mission: missionIn(event),
			});
		});

		// Not `onConnect`. It fires only after a RE-connection, and its meaning is
		// "there is a gap in what you were told" — so whoever cares refetches.
		// Called on a first connection it would make every screen reload what it
		// had just loaded.
		//
		// Announced as a FACT rather than by calling a ViewModel: a bridge that
		// called `missionsVM.refresh()` would be a stream package knowing a
		// screen's name, and every new screen that needs to catch up would be an
		// edit to this file.
		onReconnect(() => {
			atlasStreamReconnected.trigger({ wire: "events" });
		});
	});
