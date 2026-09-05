import { createLankaGrpcGateway, createLankaGrpcJsonCodec } from "../../src/index";
import type { IALankaGrpcGatewayConfig, ILankaGrpcMethod } from "../../src/index";

/** A tag on the desk. */
export interface IPlaygroundTag {
	id: string;
	name: string;
}

const LIST_TAGS: ILankaGrpcMethod<Record<string, never>, { tags: IPlaygroundTag[] }> = {
	path: "/playground.Tags/List",
	codec: createLankaGrpcJsonCodec<Record<string, never>, { tags: IPlaygroundTag[] }>(),
};

/**
 * The same gateway written by calling.
 *
 * The context `{ unary }` is the class's protected surface handed over as an
 * object, so a consumer switching styles moves `this.unary(...)` to `unary(...)`
 * and changes nothing else.
 */
export const createPlaygroundTagGateway = (config: IALankaGrpcGatewayConfig) =>
	createLankaGrpcGateway({
		...config,
		methods: ({ unary }) => ({
			list: () => unary(LIST_TAGS, {}),
		}),
	});
