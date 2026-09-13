import { sendAtlasJson } from "../routing/send-atlas-json/sendAtlasJson";
import type { AtlasWorld } from "../atlas-world/AtlasWorld";
import type { IAtlasCall } from "../_interfaces/IAtlasRoute";

/** What GraphQL answers: data, errors, or both. */
interface IAtlasGraphqlResult {
	data: Record<string, unknown> | null;
	errors?: readonly Record<string, unknown>[];
}

/** One operation this server knows, recognised by the field a document asks for. */
interface IAtlasOperation {
	field: string;
	run: (world: AtlasWorld, variables: Record<string, unknown>) => IAtlasGraphqlResult;
}

const idIn = (variables: Record<string, unknown>): string =>
	typeof variables.id === "string" ? variables.id : "";

const refuse = (message: string, code: string): IAtlasGraphqlResult => ({
	data: null,
	errors: [{ message, extensions: { code } }],
});

/**
 * The operations, as a table read in order.
 *
 * Recognised by the FIELD NAME appearing in the document rather than by parsing
 * it. That is a shortcut a real server may not take, and it is stated here
 * rather than hidden: shipping a GraphQL parser to make a test server answer
 * four operations would be paying for a compiler to read four words.
 *
 * `completeMission` stands above `mission`, because a document naming the first
 * also contains the second as a substring — the same ordering rule the HTTP
 * route table follows, and for the same reason.
 */
const OPERATIONS: readonly IAtlasOperation[] = Object.freeze([
	{
		field: "completeMission",
		run: (world, variables) => {
			const mission = world.mission(idIn(variables));
			if (!mission) return refuse("no such mission", "NOT_FOUND");

			// A `200` carrying an `errors` array is the thing this whole package
			// exists for on the client: through an ordinary JSON request it is a
			// SUCCESS whose body somebody has to inspect, and the applications that
			// forget show a spinner over a failed mutation until a reload.
			if (mission.status === "done") {
				return refuse("that mission is already done", "ALREADY_DONE");
			}

			return { data: { completeMission: world.change(mission.id, { status: "done" }) } };
		},
	},
	{
		field: "missions",
		run: (world) => ({ data: { missions: world.missions() } }),
	},
	{
		field: "board",
		run: (world) => ({
			// A PARTIAL result: one nullable field resolved to null and said why,
			// while the rest of the page resolved. Throwing it away would be
			// throwing away a page that rendered.
			data: {
				board: {
					queued: world.missions().filter((one) => one.status === "queued").length,
					active: world.missions().filter((one) => one.status === "active").length,
					forecast: null,
				},
			},
			errors: [
				{
					message: "the forecast service is not answering",
					path: ["board", "forecast"],
					extensions: { code: "UPSTREAM_DOWN" },
				},
			],
		}),
	},
	{
		field: "mission",
		run: (world, variables) => {
			const mission = world.mission(idIn(variables));

			return mission ? { data: { mission } } : refuse("no such mission", "NOT_FOUND");
		},
	},
]);

const bodyOf = (body: unknown): { query: string; variables: Record<string, unknown> } => {
	const given = (body ?? {}) as { query?: unknown; variables?: unknown };

	return {
		query: typeof given.query === "string" ? given.query : "",
		variables:
			typeof given.variables === "object" && given.variables !== null
				? (given.variables as Record<string, unknown>)
				: {},
	};
};

/**
 * Answers one GraphQL request, always with `200` unless the transport failed.
 *
 * Always 200 for an operation-level failure, because that is what GraphQL
 * servers do and what the client package is written against. A server that
 * answered 400 here would let a plain JSON request kind look correct, and the
 * defect would appear only against a real backend.
 */
export const answerAtlasGraphql = (call: IAtlasCall, world: AtlasWorld): void => {
	const { query, variables } = bodyOf(call.body);
	const operation = OPERATIONS.find((one) => query.includes(one.field));

	if (!operation) {
		return sendAtlasJson(call.response, 200, {
			data: null,
			errors: [
				{ message: "this server knows no such operation", extensions: { code: "UNKNOWN" } },
			],
		});
	}

	sendAtlasJson(call.response, 200, operation.run(world, variables));
};
