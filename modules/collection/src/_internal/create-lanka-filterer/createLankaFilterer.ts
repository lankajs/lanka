import { lankaFilterMatchers } from "../../lanka-filter-matchers/lankaFilterMatchers";
import { haveSameOrder } from "../../_utils/haveSameOrder";
import type { ILankaFilterRule } from "../../_interfaces/ILankaFilterRule";
import type { TLankaFilterMatcher } from "../../_types/TLankaFilterMatcher";
import type { TLankaFilterOperator } from "../../_types/TLankaFilterOperator";
import type { TLankaValueReader } from "../../_types/TLankaValueReader";

/**
 * Filtering against a list of rules, memoised on the arguments it was given.
 *
 * Rules rather than a `Record<field, value>`: two conditions on one field —
 * "created after Monday" and "created before Friday" — cannot both fit in an
 * object keyed by field, and every table that filters dates needs exactly that.
 */
export const createLankaFilterer = <TItem>(
	getValue: TLankaValueReader<TItem>,
	matchers: Record<TLankaFilterOperator, TLankaFilterMatcher> = lankaFilterMatchers,
) => {
	let lastItems: readonly TItem[] | null = null;
	let lastRules: readonly ILankaFilterRule<TItem>[] | null = null;
	let lastResult: readonly TItem[] = [];

	return (
		items: readonly TItem[],
		rules: readonly ILankaFilterRule<TItem>[],
	): readonly TItem[] => {
		if (rules.length === 0) return items;
		if (lastItems === items && lastRules === rules) return lastResult;

		const questions = rules.map((rule) => compileRule(rule, getValue, matchers));

		const kept = items.filter((item) => {
			for (let index = 0; index < questions.length; index += 1) {
				if (!questions[index](item)) return false;
			}

			return true;
		});

		lastItems = items;
		lastRules = rules;
		lastResult = haveSameOrder(kept, items) ? items : kept;

		return lastResult;
	};
};

/**
 * One rule, turned into the question it asks of a row.
 *
 * What a rule decides ONCE — which reader gets the value, which matcher answers,
 * whether it filters at all — is decided here instead of per row. A thousand rows
 * used to ask the same four questions a thousand times, and none of the answers
 * could change between them.
 */
const compileRule = <TItem>(
	rule: ILankaFilterRule<TItem>,
	getValue: TLankaValueReader<TItem>,
	matchers: Record<TLankaFilterOperator, TLankaFilterMatcher>,
): ((item: TItem) => boolean) => {
	const read = rule.getValue ?? ((item: TItem) => getValue(item, rule.field));
	const { match, value } = rule;

	if (match) return (item) => match(read(item), value);

	// An empty filter value is not a filter: a cleared search box asks for
	// everything, and matching "" against every row would answer the same by
	// accident rather than on purpose.
	if (value == null || value === "") return () => true;

	const matcher = matchers[rule.operator ?? "contains"];

	return (item) => matcher(read(item), value);
};
