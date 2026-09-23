import {
	AtlasMissionGateway,
	atlasMissionAssigned,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { createApp, defineComponent, h } from "vue";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import { lankaRelay } from "@lankajs/plugin-relay";
import { startLanka } from "lanka/bootstrap";
import { useLankaVM } from "@lankajs/vue";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * A module that runs ITS OWN lanka, on purpose.
 *
 * The arrangement a relay is for: an application that cannot share the shell's
 * copy — another version of the framework, another team's pipeline, isolation
 * by decision — and still has to hear what happens on the page. It starts its
 * own framework, joins the channel for the one event it needs, and owns the
 * scope its screen lives in, since a scope belongs to one copy and the shell's
 * cannot be handed across.
 */

/** The page's channel: the one name this module shares with the shell. */
const CHANNEL = "atlas";

const missions = defineLankaVM({
	name: "MissionsIsolatedVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

const missionsView = (viewModel: ReturnType<typeof createAtlasMissionsVM>) =>
	defineComponent({
		setup() {
			const state = useLankaVM(viewModel);

			return () =>
				h(
					"ul",
					{ "aria-label": "Missions, isolated" },
					state.value
						.rows()
						.items.map((mission) =>
							h("li", { key: mission.id }, `${mission.code} ${mission.title}`),
						),
				);
		},
	});

/**
 * Starts this module's framework and mounts its screen.
 *
 * Asynchronous, because starting a framework is. What comes back takes the
 * module off the page entirely: the screen, its scope, and its place on the
 * channel.
 */
export const mountMissionsIsolated = async (
	element: Element,
	rows: readonly IAtlasMission[],
): Promise<() => void> => {
	const lanka = await startLanka({
		plugins: [lankaRelay({ channel: CHANNEL, receive: [atlasMissionAssigned.eventType] })],
	});
	const scope = lanka.createScope();

	const viewModel = resolveLankaVM(missions, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const app = createApp(missionsView(viewModel));
	app.mount(element);

	return () => {
		app.unmount();
		scope.dispose();
		lanka.dispose();
	};
};
