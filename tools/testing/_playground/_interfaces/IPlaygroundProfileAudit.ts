/** What the application records a load with — a singleton it resolves by name. */
export interface IPlaygroundProfileAudit {
	record: (name: string) => void;
	readonly recorded: readonly string[];
}
