import type { IPlaygroundFile } from "../_interfaces/IPlaygroundFile";

/**
 * A consumer's project, shaped like an APPLICATION.
 *
 * That shape is the point: these rules inspect layering, and a fixture built
 * from framework files would prove the wrong thing. Each entry is one decision
 * the rules exist to make, stated with the reason it matters.
 */
export const playgroundFiles = {
	/** A module importing a module: the upper layer knows itself. */
	moduleToModule: {
		filename: "src/Modules/Thing/ThingCard.tsx",
		code: 'import { Button } from "@Modules/_Shared/Button";',
	},
	/** The core reaching up into a module: one import, everyone depends on it. */
	coreToModule: {
		filename: "src/Core/Helpers/date.ts",
		code: 'import { ThingCard } from "@Modules/Thing/ThingCard";',
	},
	/** A gateway where it belongs. */
	gatewayInViewModel: {
		filename: "src/ViewModels/ThingViewModel/ThingViewModel.ts",
		code: 'import { thingsGateway } from "@Gateways/ThingsGateway";',
	},
	/** A gateway in a component: the screen loses loading, failure, cancellation. */
	gatewayInComponent: {
		filename: "src/Modules/Thing/ThingCard.tsx",
		code: 'import { thingsGateway } from "@Gateways/ThingsGateway";',
	},
	/** A gateway calling a gateway: a request chain no screen owns. */
	gatewayToGateway: {
		filename: "src/Gateways/ThingsGateway/ThingsGateway.ts",
		code: 'import { userGateway } from "@Gateways/UserGateway";',
	},
	/** A ViewModel importing a ViewModel: two owners of one state. */
	viewModelToViewModel: {
		filename: "src/ViewModels/ThingViewModel/ThingViewModel.ts",
		code: 'import { useUserViewModel } from "@ViewModels/UserViewModel";',
	},
	/** A gateway written as a class — what both ancestor applications actually write. */
	gatewayAsClass: {
		filename: "src/Gateways/ThingsGateway/ThingsGateway.ts",
		code: "class ThingsGateway extends ALankaGateway {}",
	},
	/** The same gateway built by calling: the other style, equally supported. */
	gatewayByCalling: {
		filename: "src/Gateways/ThingsGateway/ThingsGateway.ts",
		code: "const thingsGateway = createLankaGateway({});",
	},
	/** A ViewModel built by calling — what both ancestor applications actually write. */
	viewModelByCalling: {
		filename: "src/ViewModels/ThingViewModel/ThingViewModel.ts",
		code: "const useGapVM = createLankaVM({});",
	},
	/** The same ViewModel written as a class: the other style, equally supported. */
	viewModelAsClass: {
		filename: "src/ViewModels/ThingViewModel/ThingViewModel.ts",
		code: "class ThingVM extends ALankaVM {}",
	},
	/** The application reading its own DI barrels: a second, invisible path. */
	diBarrelInApp: {
		filename: "src/ViewModels/ThingViewModel/ThingViewModel.ts",
		code: 'import { Scenarios } from "@lanka_di/Scenarios";',
	},
} satisfies Record<string, IPlaygroundFile>;
