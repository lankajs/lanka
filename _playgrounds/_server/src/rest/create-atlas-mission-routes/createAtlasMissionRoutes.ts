import { authorizeAtlasCall } from "../authorize-atlas-call/authorizeAtlasCall";
import { requireAtlasCsrf } from "../require-atlas-csrf/requireAtlasCsrf";
import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import { validateAtlasMissionInput } from "../../validate-atlas-mission-input/validateAtlasMissionInput";
import type { IAtlasApi } from "../../_interfaces/IAtlasApi";
import type { IAtlasCall, IAtlasRoute } from "../../_interfaces/IAtlasRoute";
import type { IAtlasMission } from "../../_interfaces/IAtlasMission";

/** A draft as it arrives: every field still `unknown` until something checks it. */
interface IAtlasMissionBody {
	title?: unknown;
	priority?: unknown;
	crewId?: unknown;
}

const bodyOf = (body: unknown): IAtlasMissionBody => body ?? {};

const headerOf = (call: IAtlasCall, name: string): string | undefined => {
	const value = call.request.headers[name];

	return Array.isArray(value) ? value[0] : value;
};

/**
 * The shape a client that has not been updated still speaks.
 *
 * It exists so an application has a reason to map a wire format into its own
 * vocabulary — two schemas rather than an adapter layer. Without one, the
 * mapping in a gateway would be a demonstration with nothing to demonstrate on.
 */
const asLegacyRow = (mission: IAtlasMission): Record<string, unknown> => ({
	mission_id: mission.id,
	mission_title: mission.title,
	mission_state: mission.status.toUpperCase(),
	assigned_to: mission.crewId,
	changed_at: Math.floor(new Date(mission.updatedAt).getTime() / 1000),
});

/** Refuses a body with a message per field, in the shape form libraries read. */
const refuseFields = (call: IAtlasCall, errors: Record<string, string[]>): void => {
	sendAtlasJson(call.response, 422, {
		detail: "this mission cannot be saved as it stands",
		errors,
	});
};

const createMission = (call: IAtlasCall, api: IAtlasApi): void => {
	const body = bodyOf(call.body);
	const errors = validateAtlasMissionInput(body);
	if (Object.keys(errors).length > 0) return refuseFields(call, errors);

	const key = headerOf(call, "idempotency-key");
	const mission = api.created.once(key, () =>
		api.world.add({
			title: String(body.title),
			priority: body.priority === undefined ? undefined : Number(body.priority),
			crewId: typeof body.crewId === "string" ? body.crewId : null,
		}),
	);

	// The key is echoed so a client can SEE that a retry was recognised. Without
	// it, "the second POST created nothing" and "the second POST never happened"
	// look identical from the outside.
	sendAtlasJson(call.response, 201, mission, key === undefined ? {} : { "idempotency-key": key });
};

const changeMission = (call: IAtlasCall, api: IAtlasApi): void => {
	const body = bodyOf(call.body);
	const errors = validateAtlasMissionInput(body);
	if (Object.keys(errors).length > 0) return refuseFields(call, errors);

	const mission = api.world.change(call.params.id, {
		title: typeof body.title === "string" ? body.title : undefined,
		priority: body.priority === undefined ? undefined : Number(body.priority),
	});

	if (!mission) return sendAtlasJson(call.response, 404, { code: "NO_SUCH_MISSION" });

	sendAtlasJson(call.response, 200, mission);
};

const assignMission = (call: IAtlasCall, api: IAtlasApi): void => {
	const crewId = bodyOf(call.body).crewId;
	const known = api.world.crew().some((member) => member.id === crewId);

	if (crewId !== null && !known) {
		// A refusal the server MEANT, which is what `kind: "domain"` is for on the
		// client: retrying gives the same answer, later.
		return sendAtlasJson(call.response, 409, {
			code: "NO_SUCH_CREW",
			detail: "that crew member is not on the roster",
		});
	}

	const mission = api.world.change(call.params.id, { crewId: crewId as string | null });
	if (!mission) return sendAtlasJson(call.response, 404, { code: "NO_SUCH_MISSION" });

	sendAtlasJson(call.response, 200, mission);
};

const completeMission = (call: IAtlasCall, api: IAtlasApi): void => {
	const mission = api.world.change(call.params.id, { status: "done" });
	if (!mission) return sendAtlasJson(call.response, 404, { code: "NO_SUCH_MISSION" });

	sendAtlasJson(call.response, 200, mission);
};

/**
 * Runs the work only for a caller who is signed in and proved enough.
 *
 * "Enough" depends on how they signed in: a cookie caller also proves the
 * request came from this application, a bearer caller has already proved it by
 * setting a header nobody else can set on their behalf.
 */
const guarded =
	(api: IAtlasApi, work: (call: IAtlasCall, api: IAtlasApi) => void) =>
	(call: IAtlasCall): void => {
		const caller = authorizeAtlasCall(call, api.sessions);
		if (!caller) return;
		if (caller.viaCookie && !requireAtlasCsrf(call, api.sessions)) return;

		work(call, api);
	};

/**
 * Everything an application asks of the server about missions.
 *
 * `/missions/legacy` stands ABOVE `/missions/:id` because the table is read in
 * order: below it, the literal would be captured as an id and the legacy shape
 * would answer "no such mission".
 */
export const createAtlasMissionRoutes = (api: IAtlasApi): readonly IAtlasRoute[] =>
	Object.freeze([
		{
			method: "GET",
			path: "/missions",
			run: ({ response, query }) => {
				const status = query.get("status");
				const missions = api.world
					.missions()
					.filter((mission) => status === null || mission.status === status);

				sendAtlasJson(response, 200, missions);
			},
		},
		{
			method: "GET",
			path: "/missions/legacy",
			run: ({ response }) => {
				sendAtlasJson(response, 200, { rows: api.world.missions().map(asLegacyRow) });
			},
		},
		{
			method: "GET",
			path: "/missions/:id",
			run: ({ response, params }) => {
				const mission = api.world.mission(params.id);
				if (!mission) return sendAtlasJson(response, 404, { code: "NO_SUCH_MISSION" });

				sendAtlasJson(response, 200, mission);
			},
		},
		{ method: "POST", path: "/missions", run: guarded(api, createMission) },
		{ method: "PATCH", path: "/missions/:id", run: guarded(api, changeMission) },
		{ method: "POST", path: "/missions/:id/assign", run: guarded(api, assignMission) },
		{ method: "POST", path: "/missions/:id/complete", run: guarded(api, completeMission) },
		{
			method: "DELETE",
			path: "/missions/:id",
			run: guarded(api, (call) => {
				if (!api.world.drop(call.params.id)) {
					return sendAtlasJson(call.response, 404, { code: "NO_SUCH_MISSION" });
				}

				sendAtlasJson(call.response, 200, { id: call.params.id });
			}),
		},
	] satisfies IAtlasRoute[]);
