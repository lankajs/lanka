import {
	createLankaCollectionView,
	nextLankaSortState,
	type ILankaFilterRule,
	type ILankaSortState,
} from "../../src/index";
import { playgroundHiredBeforeMatchers } from "../playground-hired-before-matchers/playgroundHiredBeforeMatchers";
import type { IPlaygroundEmployee } from "../_interfaces/IPlaygroundEmployee";

/**
 * The table screen, the way a ViewModel writes one.
 *
 * The view is built ONCE and held beside the state, which is the only shape that
 * works: rebuilt inside an action it would remember nothing, and remembering is
 * the whole product.
 *
 * The order of the four calls is this screen's decision — filter, then sort,
 * then page. Paginating before filtering would give a different page, and only
 * a screen knows which it meant.
 */
export const createPlaygroundEmployeeList = () => {
	const view = createLankaCollectionView<IPlaygroundEmployee, number>({
		getValue: (employee, field) =>
			field === "role" ? employee.role.name : (employee[field as "name"] ?? null),
		getId: (employee) => employee.id,
		// This screen filters by hire date, which the ten shipped operators handle
		// as text. One entry replaces the one that was wrong for it.
		matchers: playgroundHiredBeforeMatchers,
	});

	let rows: readonly IPlaygroundEmployee[] = [];
	let sort: ILankaSortState = { field: null, order: null };
	let rules: readonly ILankaFilterRule<IPlaygroundEmployee>[] = [];
	let page = 1;

	return {
		/** What the server just answered, stabilised against what is on screen. */
		receive(next: readonly IPlaygroundEmployee[]): void {
			rows = view.stabilise(next);
		},

		clickHeader(field: string): void {
			sort = nextLankaSortState(sort, field);
			page = 1;
		},

		search(term: string): void {
			rules = [{ field: "name", value: term }];
			page = 1;
		},

		hiredBefore(date: Date): void {
			rules = [
				{ field: "hiredAt", value: date, operator: "lt", getValue: (row) => row.hiredAt },
			];
			page = 1;
		},

		goToPage(next: number): void {
			page = next;
		},

		get sortState(): ILankaSortState {
			return sort;
		},

		/** What the screen renders: one page of filtered, sorted rows. */
		get visible() {
			return view.paginate(view.sort(view.filter(rows, rules), sort), page, 2);
		},
	};
};
