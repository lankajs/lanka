import { ALankaGateway } from "lanka/gateway";
import { lankaYupValidator } from "@lankajs/yup";
import { atlasSessionSchema } from "../../Core/Validation/atlasSessionSchema";
import type { IAtlasCredentials } from "../../Core/Interfaces/IAtlasCredentials";
import type { ILankaRequest, TLankaRequestInit } from "lanka/gateway";

/**
 * Signing in, and swapping a spent token for a fresh one.
 *
 * Its own gateway rather than three methods on another, because a gateway is one
 * subject's worth of endpoints — and because the refresh call is the one request
 * in the application that must NOT go through the auth policy that wraps every
 * other. A 401 on the refresh route refreshing would be a loop with no end.
 *
 * The validator is yup's: the session is the one shape in this application
 * written in a dialect the `standard` port cannot read, so it is checked by the
 * package that can.
 */
export class AtlasSessionGateway extends ALankaGateway<TLankaRequestInit> {
	public constructor(request?: ILankaRequest<TLankaRequestInit>) {
		super({ basePath: "/session", request, validationService: lankaYupValidator });
	}

	public async open(name: string): Promise<IAtlasCredentials> {
		const body = await this.request<unknown>(this.endpoint(), {
			method: "POST",
			body: { name },
		});

		return this.validationService.validate<IAtlasCredentials>(
			atlasSessionSchema,
			body,
			"session.open",
		);
	}

	public async renew(refreshToken: string): Promise<IAtlasCredentials> {
		const body = await this.request<unknown>(this.endpoint("refresh"), {
			method: "POST",
			body: { refreshToken },
		});

		return this.validationService.validate<IAtlasCredentials>(
			atlasSessionSchema,
			body,
			"session.renew",
		);
	}

	/**
	 * Who the server thinks is calling. The one endpoint that spends a token.
	 *
	 * The leading slash is load-bearing: a path that starts with one skips this
	 * gateway's `basePath` and is joined to the API base alone. `/me` is not under
	 * `/session`, and writing it `me` would ask for `/session/me`.
	 */
	public whoAmI(): Promise<{ name: string; callsLeft: number }> {
		return this.request<{ name: string; callsLeft: number }>(this.endpoint("/me"));
	}
}
