/** Everything the rename screen can do. */
export interface IPlaygroundRenameActions {
	load: (id: number) => Promise<void>;
	setCustomer: (customer: string) => void;
	setNote: (note: string) => void;
	submit: () => Promise<void>;
}
