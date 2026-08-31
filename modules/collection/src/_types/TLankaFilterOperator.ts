/**
 * How a filter value is compared with a row's.
 *
 * A closed union rather than a free string: an operator nobody implemented would
 * otherwise filter nothing and look like an empty result.
 */
export type TLankaFilterOperator =
	"eq" | "neq" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "in";
