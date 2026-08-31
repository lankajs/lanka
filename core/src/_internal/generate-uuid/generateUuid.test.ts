import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "./generateUuid";

describe("generateUuid", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("crypto.randomUUID branch", () => {
		it("uses crypto.randomUUID when available", () => {
			const mockUuid = "123e4567-e89b-12d3-a456-426614174000";

			vi.stubGlobal("crypto", {
				randomUUID: vi.fn(() => mockUuid),
			});

			const result = generateUuid();

			expect(result).toBe(mockUuid);
			expect(crypto.randomUUID).toHaveBeenCalledOnce();
		});
	});

	describe("fallback branch", () => {
		beforeEach(() => {
			vi.stubGlobal("crypto", undefined);
		});

		it("returns a valid UUID v4 format", () => {
			const uuid = generateUuid();

			expect(uuid).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		it("generates different values on subsequent calls", () => {
			const first = generateUuid();
			const second = generateUuid();

			expect(first).not.toBe(second);
		});

		it("works without performance.now", () => {
			vi.stubGlobal("performance", undefined);

			const uuid = generateUuid();

			expect(uuid).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});
	});

	describe("complex behavior", () => {
		it("always sets UUID version to 4", () => {
			for (let i = 0; i < 100; i += 1) {
				const uuid = generateUuid();
				expect(uuid[14]).toBe("4");
			}
		});

		it("sets correct UUID variant bits", () => {
			for (let i = 0; i < 100; i += 1) {
				const uuid = generateUuid();
				const variant = uuid[19];
				expect(["8", "9", "a", "b"]).toContain(variant);
			}
		});
	});

	describe("stress: uniqueness and performance", () => {
		it("stress: generates many UUIDs without collisions", () => {
			const set = new Set<string>();

			for (let i = 0; i < 20_000; i += 1) {
				const uuid = generateUuid();
				expect(set.has(uuid)).toBe(false);
				set.add(uuid);
			}
		});

		it("stress: timing test", () => {
			const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

			const start = now();
			for (let i = 0; i < 50_000; i += 1) {
				void generateUuid();
			}
			const durationMs = now() - start;

			console.info(`generateUuid stress duration: ${durationMs.toFixed(2)}ms`);

			// Catastrophe threshold, not a precise one: wall-clock in a shared run
			// measures machine load as much as the code. It catches an order-of-
			// magnitude regression and ignores a busy neighbour core.
			expect(durationMs).toBeLessThan(5_000);
		});
	});
});
