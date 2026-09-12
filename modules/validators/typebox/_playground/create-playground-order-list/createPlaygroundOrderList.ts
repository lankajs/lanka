import { lankaTypeBoxValidator } from "../../src/index";
import { playgroundRowSchema } from "../playground-row-schema/playgroundRowSchema";
import type { IPlaygroundListState } from "../_interfaces/IPlaygroundListState";

/**
 * A list screen reading a page of rows, which is where TypeBox earns its place.
 *
 * One schema, validated a hundred times against one compiled checker. That is
 * the shape the package is built for, and the reason the cache is keyed by the
 * schema object rather than by anything the rows carry.
 *
 * It reads rows ONE AT A TIME rather than validating the page as an array, and
 * that is the decision worth reading: a page of twenty where the ninth row is
 * broken should render nineteen rows and one message, not an empty screen. A
 * schema over the whole array gives the second answer.
 */
export const createPlaygroundOrderList = () => {
	const state: IPlaygroundListState = { rows: [], refused: [] };

	return {
		get state(): IPlaygroundListState {
			return state;
		},

		read(page: unknown[]): IPlaygroundListState {
			state.rows = [];
			state.refused = [];

			page.forEach((row, index) => {
				const result = lankaTypeBoxValidator.validateSafe(playgroundRowSchema, row);

				if (result.success) state.rows.push(result.data);
				else state.refused.push(`${String(index)}: ${result.errors.join("; ")}`);
			});

			return state;
		},
	};
};
