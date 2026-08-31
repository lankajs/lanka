export interface ILankaListQueryParams {
	page: number;
	limit: number;
	sortField?: string | null;
	sortOrder?: string | null;
	filters?: Record<string, unknown>;
}
