export interface ILankaFlags {
	isMockMode?: boolean;
	loggerEnabled?: boolean;
	loggerGateway?: boolean;
	loggerScenario?: boolean;
	loggerViewModel?: boolean;
	loggerView?: boolean;
	loggerBootstrap?: boolean;
	/** Comes from `import.meta.env.PROD` — silences all log output. */
	isProduction?: boolean;
	/** Comes from `import.meta.env.DEV` — enables development-only behaviour. */
	isDevelopment?: boolean;
}
