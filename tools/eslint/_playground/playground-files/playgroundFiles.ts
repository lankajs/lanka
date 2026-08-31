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
		filename: "src/Modules/Gap/GapCard.tsx",
		code: 'import { Button } from "@Modules/_Shared/Button";',
	},
	/** The core reaching up into a module: one import, everyone depends on it. */
	coreToModule: {
		filename: "src/Core/Helpers/date.ts",
		code: 'import { GapCard } from "@Modules/Gap/GapCard";',
	},
	/** A gateway where it belongs. */
	gatewayInViewModel: {
		filename: "src/ViewModels/GapViewModel/GapViewModel.ts",
		code: 'import { gapGateway } from "@Gateways/GapGateway";',
	},
	/** A gateway in a component: the screen loses loading, failure, cancellation. */
	gatewayInComponent: {
		filename: "src/Modules/Gap/GapCard.tsx",
		code: 'import { gapGateway } from "@Gateways/GapGateway";',
	},
	/** A gateway calling a gateway: a request chain no screen owns. */
	gatewayToGateway: {
		filename: "src/Gateways/GapGateway/GapGateway.ts",
		code: 'import { userGateway } from "@Gateways/UserGateway";',
	},
	/** A ViewModel importing a ViewModel: two owners of one state. */
	viewModelToViewModel: {
		filename: "src/ViewModels/GapViewModel/GapViewModel.ts",
		code: 'import { useUserViewModel } from "@ViewModels/UserViewModel";',
	},
	/** A gateway written as a class — what both ancestor applications actually write. */
	gatewayAsClass: {
		filename: "src/Gateways/GapGateway/GapGateway.ts",
		code: "class GapGateway extends ALankaGateway {}",
	},
	/** The same gateway built by calling: the other style, equally supported. */
	gatewayByCalling: {
		filename: "src/Gateways/GapGateway/GapGateway.ts",
		code: "const gapGateway = createLankaGateway({});",
	},
	/** A ViewModel built by calling — what both ancestor applications actually write. */
	viewModelByCalling: {
		filename: "src/ViewModels/GapViewModel/GapViewModel.ts",
		code: "const useGapVM = createLankaVM({});",
	},
	/** The same ViewModel written as a class: the other style, equally supported. */
	viewModelAsClass: {
		filename: "src/ViewModels/GapViewModel/GapViewModel.ts",
		code: "class GapVM extends ALankaVM {}",
	},
	/** The application reading its own DI barrels: a second, invisible path. */
	diBarrelInApp: {
		filename: "src/ViewModels/GapViewModel/GapViewModel.ts",
		code: 'import { Scenarios } from "@lanka_di/Scenarios";',
	},
} satisfies Record<string, IPlaygroundFile>;
