/**
 * What a person may type about a mission.
 *
 * Kept apart from `IAtlasMission` on purpose: a form given the response shape
 * asks for an `id`, a `code` and an `updatedAt` the person does not have. The
 * two change for different reasons — this one when what may be typed changes,
 * the other when the server does.
 */
export interface IAtlasMissionInput {
	title: string;
	priority: number;
	crewId: string | null;
}
