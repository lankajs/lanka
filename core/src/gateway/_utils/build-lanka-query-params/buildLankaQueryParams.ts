import { TLankaQueryParams } from "../../_types/TLankaQueryParams";
import { TLankaQueryBuilder } from "../../_types/TLankaQueryBuilder";

/**
 * The query string a gateway sends, from the object a method was called with.
 *
 * Arrays become `key[]` repeated, nested objects become `key[inner]`: the shape
 * most JSON APIs read back without being told about it.
 *
 * Plain loops over `Object.keys` rather than `Object.entries` and `forEach`: this
 * runs on every request that carries a filter, and the pair array `entries`
 * builds — two allocations per key, thrown away immediately — is a cost with
 * nothing to show for it.
 */
export const buildLankaQueryParams: TLankaQueryBuilder = <T extends Record<string, unknown>>(
	input: T,
): URLSearchParams => {
	const params = new URLSearchParams();

	const append = (key: string, value: TLankaQueryParams): void => {
		if (value == null) return;

		if (Array.isArray(value)) {
			// The bracketed key once for the whole array, not once per element.
			const itemKey = `${key}[]`;
			for (let index = 0; index < value.length; index += 1) append(itemKey, value[index]);

			return;
		}

		if (typeof value === "object") {
			const inner = value as Record<string, TLankaQueryParams>;
			const innerKeys = Object.keys(inner);

			for (let index = 0; index < innerKeys.length; index += 1) {
				const innerKey = innerKeys[index];
				append(`${key}[${innerKey}]`, inner[innerKey]);
			}

			return;
		}

		params.append(key, String(value));
	};

	const source = input as Record<string, TLankaQueryParams>;
	const keys = Object.keys(source);

	for (let index = 0; index < keys.length; index += 1) append(keys[index], source[keys[index]]);

	return params;
};
