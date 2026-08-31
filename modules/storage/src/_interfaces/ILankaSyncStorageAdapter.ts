export interface ILankaSyncStorageAdapter {
	setItemSync(key: string, value: string): void;
	getItemSync(key: string): string | null;
	removeItemSync(key: string): void;
	clearSync(): void;
}
