import type { TLankaSortableValue } from "./TLankaSortableValue";

/**
 * Reads one field out of a row.
 *
 * A parameter rather than something to override: nested fields, computed
 * columns and translated labels are the application's business, and the whole
 * reason this package needs no subclass.
 */
export type TLankaValueReader<TItem> = (item: TItem, field: string) => TLankaSortableValue;
