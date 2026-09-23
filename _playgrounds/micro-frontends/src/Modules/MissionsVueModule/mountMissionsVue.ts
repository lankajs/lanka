import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { createApp, defineComponent, h } from "vue";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/vue";
import type { TMissionsMount } from "../../Core/Mount/TMissionsMount";

/** This module's own ViewModel, as a definition — the same reasoning as the React module's. */
const missions = defineLankaVM({
	name: "MissionsVueVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

/**
 * A render function rather than a single-file component.
 *
 * Deliberate: this package is typechecked by plain `tsc` because it holds React
 * and Vue at once, and a `.vue` file would need a shim that types every
 * component as taking anything.
 */
const missionsView = (viewModel: ReturnType<typeof createAtlasMissionsVM>) =>
	defineComponent({
		setup() {
			const state = useLankaVM(viewModel);

			return () =>
				h(
					"ul",
					{ "aria-label": "Missions in Vue" },
					state.value
						.rows()
						.items.map((mission) =>
							h("li", { key: mission.id }, `${mission.code} ${mission.title}`),
						),
				);
		},
	});

/** What the shell calls — the same contract as `mountMissionsReact`. */
export const mountMissionsVue: TMissionsMount = (element, { missions: rows, scope }) => {
	const viewModel = resolveLankaVM(missions, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const app = createApp(missionsView(viewModel));
	app.mount(element);

	return () => app.unmount();
};
