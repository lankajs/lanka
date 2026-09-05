import { createLankaGraphqlGateway } from "../../src/index";
import type { IALankaGraphqlGatewayConfig } from "../../src/index";

/** A tag on the board. */
export interface IPlaygroundTag {
	id: string;
	name: string;
}

const TAGS = `query Tags { tags { id name } }`;

/**
 * The same gateway written by calling.
 *
 * The context `{ query, mutate }` is the class's protected surface handed over
 * as an object, so a consumer switching styles moves `this.query(...)` to
 * `query(...)` and changes nothing else.
 */
export const createPlaygroundTagGateway = (config: IALankaGraphqlGatewayConfig) =>
	createLankaGraphqlGateway({
		...config,
		methods: ({ query }) => ({
			list: () => query<{ tags: IPlaygroundTag[] }>({ document: TAGS }),
		}),
	});
