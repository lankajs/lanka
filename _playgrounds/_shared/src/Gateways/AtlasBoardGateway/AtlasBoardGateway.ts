import { ALankaGraphqlGateway, createLankaGraphqlRequest } from "@lankajs/plugin-graphql";
import { atlasBoardSchema } from "../../Core/Validation/atlasBoardSchema";
import { atlasValidator } from "../../Core/Validation/atlasValidator";
import type { IAtlasMission } from "../../Core/Interfaces/IAtlasMission";
import type { ILankaGraphqlError } from "@lankajs/plugin-graphql";

const MISSIONS = `query Missions { missions { id code title status priority crewId updatedAt } }`;
const BOARD = `query Board { board { queued active forecast } }`;
const COMPLETE = `mutation CompleteMission($id: ID!) { completeMission(id: $id) { id status } }`;

/** How the board looks, as GraphQL answers it. */
export interface IAtlasBoardSummary {
	queued: number;
	active: number;
	/** Null when the upstream that computes it is not answering. */
	forecast: string | null;
}

/**
 * The same world over GraphQL, because one application often has both.
 *
 * The reason this is not `AtlasMissionGateway` with a different base path: a
 * GraphQL endpoint answers `200 OK` with an `errors` array, and through an
 * ordinary JSON request kind that is a SUCCESS carrying a body somebody has to
 * inspect. `ALankaGraphqlGateway` reads it and raises a `domain` failure — the
 * kind the framework already has for a server refusing deliberately — so a
 * retry policy leaves it alone and a screen shows what the server said.
 *
 * `query` and `mutate` are the same POST on the wire. The NAME is the only place
 * a call says whether it changes anything, which is why there are two members
 * and not one.
 */
export class AtlasBoardGateway extends ALankaGraphqlGateway {
	public constructor(onPartialErrors?: (errors: readonly ILankaGraphqlError[]) => void) {
		// `onPartialErrors` belongs to the REQUEST KIND, not to the gateway: the
		// request is what reads the envelope, and a gateway option would be a
		// second place to configure one thing.
		super({ basePath: "/graphql", request: createLankaGraphqlRequest({ onPartialErrors }) });
	}

	public missions(): Promise<{ missions: IAtlasMission[] }> {
		return this.query<{ missions: IAtlasMission[] }>({ document: MISSIONS });
	}

	/**
	 * The summary — the one call that regularly answers data AND errors.
	 *
	 * A partial result means a nullable field resolved to `null` and said why
	 * while the rest of the page resolved. The data comes back and the reason
	 * goes to `onPartialErrors`; throwing it away would be throwing away a page
	 * that rendered.
	 */
	public async summary(): Promise<IAtlasBoardSummary> {
		const answer = await this.query<{ board: unknown }>({ document: BOARD });

		return atlasValidator.validate<IAtlasBoardSummary>(
			atlasBoardSchema,
			answer.board,
			"board.summary",
		);
	}

	public complete(id: string): Promise<{ completeMission: IAtlasMission }> {
		return this.mutate<{ completeMission: IAtlasMission }>({
			document: COMPLETE,
			variables: { id },
		});
	}
}
