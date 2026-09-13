import { ALankaGateway } from "lanka/gateway";
import { createLankaApiError } from "lanka/errors";
import { lankaValibotValidator } from "@lankajs/valibot";
import { atlasMissionInputSchema } from "../../Core/Validation/atlasMissionInputSchema";
import { atlasMissionSchema } from "../../Core/Validation/atlasMissionSchema";
import { atlasMissionWireSchema } from "../../Core/Validation/atlasMissionWireSchema";
import { atlasValidator } from "../../Core/Validation/atlasValidator";
import type { IAtlasMission, TAtlasMissionStatus } from "../../Core/Interfaces/IAtlasMission";
import type { IAtlasMissionInput } from "../../Core/Interfaces/IAtlasMissionInput";
import type { ILankaRequest, TLankaExecuteOptions } from "lanka/gateway";
import type { TLankaRequestInit } from "lanka/gateway";

/** Everything a caller may pass through to the request layer, and nothing more. */
export type TAtlasCallOptions = TLankaExecuteOptions<TLankaRequestInit>;

/**
 * Every endpoint this application has about missions, and nothing else.
 *
 * Written as a CLASS, while the crew gateway beside it is written by calling.
 * Both build the same object; the difference is which one a team reads more
 * easily, and an application that shows only one style cannot demonstrate that.
 *
 * What is NOT here is as much of the point as what is: no loading flag, no retry,
 * no decision about what a failure means. Those belong to the ViewModel that
 * calls this, which is why this file is short and stays short.
 */
export class AtlasMissionGateway extends ALankaGateway<TLankaRequestInit> {
	public constructor(request?: ILankaRequest<TLankaRequestInit>) {
		// The validator is the HUB, because this application's schemas come from
		// four dialects. A gateway holding one validator and serving every feature
		// is what the hub is for.
		super({ basePath: "/missions", request, validationService: atlasValidator });
	}

	/** The list, checked before anybody reads it. */
	public async list(options?: TAtlasCallOptions): Promise<IAtlasMission[]> {
		const body = await this.request<unknown>(this.endpoint(), options);

		return (Array.isArray(body) ? body : []).map((row) =>
			this.validationService.validate<IAtlasMission>(
				atlasMissionSchema,
				row,
				"missions.list",
			),
		);
	}

	public async byId(id: string, options?: TAtlasCallOptions): Promise<IAtlasMission> {
		const body = await this.request<unknown>(this.endpoint(id), options);

		return this.validationService.validate<IAtlasMission>(
			atlasMissionSchema,
			body,
			"missions.byId",
		);
	}

	/** The list a status filter narrows, built through the query builder. */
	public byStatus(
		status: TAtlasMissionStatus,
		options?: TAtlasCallOptions,
	): Promise<IAtlasMission[]> {
		const query = this.buildQueryParams({ status });

		return this.request<IAtlasMission[]>(this.endpoint(`?${query.toString()}`), options);
	}

	/**
	 * The list from the older endpoint, in two steps.
	 *
	 * Two, because they are two jobs: the first maps a wire format into this
	 * application's vocabulary and changes when the SERVER changes; the second
	 * states what the application requires and changes when the APPLICATION does.
	 * There is no adapter layer between them because there is nothing for one to
	 * do — Standard Schema's validate answers the transformed value.
	 *
	 * The first validator is valibot's and the second the hub's, which is also
	 * the point: one gateway, two libraries, no adapter either way.
	 */
	public async listFromLegacyApi(options?: TAtlasCallOptions): Promise<IAtlasMission[]> {
		const body = await this.request<{ rows?: unknown[] }>(this.endpoint("legacy"), options);

		return (body.rows ?? []).map((row) => {
			const mapped = lankaValibotValidator.validate(
				atlasMissionWireSchema,
				row,
				"missions.map",
			);

			return this.validationService.validate<IAtlasMission>(
				atlasMissionSchema,
				mapped,
				"missions.legacy",
			);
		});
	}

	/**
	 * Creates a mission, checking the payload with the schema the FORM uses.
	 *
	 * The same object, read twice: once where the person types and once on the
	 * way out. Declaring the rule twice is how a client and a server come to
	 * disagree about what a valid mission is.
	 */
	public async create(
		input: IAtlasMissionInput,
		options?: TAtlasCallOptions,
	): Promise<IAtlasMission> {
		const payload = this.validationService.validate<IAtlasMissionInput>(
			atlasMissionInputSchema,
			input,
			"missions.create.payload",
		);
		const body = await this.request<unknown>(this.endpoint(), {
			...options,
			method: "POST",
			body: payload,
		});

		return this.validationService.validate<IAtlasMission>(
			atlasMissionSchema,
			body,
			"missions.create",
		);
	}

	public rename(id: string, title: string, options?: TAtlasCallOptions): Promise<IAtlasMission> {
		return this.request<IAtlasMission>(this.endpoint(id), {
			...options,
			method: "PATCH",
			body: { title },
		});
	}

	/**
	 * Assigns a mission, refusing locally what cannot succeed.
	 *
	 * The refusal is built with the framework's own factory rather than a bare
	 * `throw`, so a screen has ONE failure shape to render whether the no came
	 * from here or from the server.
	 */
	public assign(
		id: string,
		crewId: string | null,
		options?: TAtlasCallOptions,
	): Promise<IAtlasMission> {
		if (id.trim().length === 0) {
			return Promise.reject(createLankaApiError(400, ["a mission id is required"]));
		}

		return this.request<IAtlasMission>(this.endpoint(`${id}/assign`), {
			...options,
			method: "POST",
			body: { crewId },
		});
	}

	public complete(id: string, options?: TAtlasCallOptions): Promise<IAtlasMission> {
		return this.request<IAtlasMission>(this.endpoint(`${id}/complete`), {
			...options,
			method: "POST",
		});
	}

	public remove(id: string, options?: TAtlasCallOptions): Promise<{ id: string }> {
		return this.request<{ id: string }>(this.endpoint(id), { ...options, method: "DELETE" });
	}
}
