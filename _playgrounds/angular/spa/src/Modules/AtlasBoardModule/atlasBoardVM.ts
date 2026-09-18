import { InjectionToken } from "@angular/core";
import type { AtlasBoardVM } from "@lanka-playgrounds/_shared";

/**
 * How an Angular screen is GIVEN the board ViewModel.
 *
 * The same decision `@lanka-playgrounds/angular-shared` makes for the missions
 * ViewModel, and it lives HERE rather than there because there is nothing about
 * it two Angular hosts would share — the board screen has one caller, and a
 * token in the shared package would be a layer with no reason.
 */
export const ATLAS_BOARD_VM = new InjectionToken<ReturnType<AtlasBoardVM["build"]>>(
	"ATLAS_BOARD_VM",
);
