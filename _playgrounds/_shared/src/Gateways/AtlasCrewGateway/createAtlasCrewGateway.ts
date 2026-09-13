import { createLankaGateway } from "lanka/gateway";
import { lankaArkTypeValidator } from "@lankajs/arktype";
import { atlasCrewSchema } from "../../Core/Validation/atlasCrewSchema";
import type { IAtlasCrewMember } from "../../Core/Interfaces/IAtlasCrewMember";
import type { TAtlasCallOptions } from "../AtlasMissionGateway/AtlasMissionGateway";
import type { TLankaRequestInit } from "lanka/gateway";

/** What the crew gateway offers. Named, so a ViewModel can hold the port. */
export interface IAtlasCrewGateway {
	list: (options?: TAtlasCallOptions) => Promise<IAtlasCrewMember[]>;
}

/**
 * The crew, written by CALLING rather than by extending.
 *
 * The same class underneath: `createLankaGateway` builds an `ALankaGateway` and
 * hands its protected surface over as an object, so `this.endpoint(…)` becomes
 * `endpoint(…)` and nothing else changes. A fix to the framework reaches both
 * styles at once, which is the property the two-styles rule exists for — and a
 * playground that wrote every gateway the same way could not show it.
 *
 * The validator is arktype's, while the mission gateway holds the hub and the
 * legacy mapping holds valibot's. Three libraries of ONE dialect, in one
 * application, needing no routing between them.
 */
export const createAtlasCrewGateway = (): IAtlasCrewGateway =>
	createLankaGateway<TLankaRequestInit, IAtlasCrewGateway>({
		basePath: "/crew",
		validationService: lankaArkTypeValidator,
		methods: ({ endpoint, request, validationService }) => ({
			list: async (options) => {
				const body = await request<unknown>(endpoint(), options);

				return (Array.isArray(body) ? body : []).map((row) =>
					validationService.validate<IAtlasCrewMember>(atlasCrewSchema, row, "crew.list"),
				);
			},
		}),
	});
