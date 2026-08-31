import { beforeEach, describe, expect, it } from "vitest";
import { caseConvert } from "./caseConvert";

describe("caseConvert", () => {
	beforeEach(() => {});

	describe("basic conversions", () => {
		it("converts to camelCase", () => {
			expect(caseConvert("hello world", "camelCase")).toBe("helloWorld");
			expect(caseConvert("Hello_world", "camelCase")).toBe("helloWorld");
			expect(caseConvert("hello-world", "camelCase")).toBe("helloWorld");
		});

		it("converts to kebabCase", () => {
			expect(caseConvert("hello world", "kebabCase")).toBe("hello-world");
			expect(caseConvert("HelloWorld", "kebabCase")).toBe("hello-world");
			expect(caseConvert("hello_world", "kebabCase")).toBe("hello-world");
		});

		it("converts to snakeCase", () => {
			expect(caseConvert("hello world", "snakeCase")).toBe("hello_world");
			expect(caseConvert("HelloWorld", "snakeCase")).toBe("hello_world");
			expect(caseConvert("hello-world", "snakeCase")).toBe("hello_world");
		});

		it("converts to pascalCase", () => {
			expect(caseConvert("hello world", "pascalCase")).toBe("HelloWorld");
			expect(caseConvert("hello_world", "pascalCase")).toBe("HelloWorld");
			expect(caseConvert("hello-world", "pascalCase")).toBe("HelloWorld");
		});

		it("converts to titleCase", () => {
			expect(caseConvert("hello world", "titleCase")).toBe("Hello World");
			expect(caseConvert("hello_world", "titleCase")).toBe("Hello World");
			expect(caseConvert("hello-world", "titleCase")).toBe("Hello World");
		});
	});

	describe("complex input cases", () => {
		it("handles multiple separators", () => {
			expect(caseConvert("hello__world---test", "camelCase")).toBe("helloWorldTest");
			expect(caseConvert("hello__world---test", "kebabCase")).toBe("hello-world-test");
		});

		it("handles leading and trailing spaces", () => {
			expect(caseConvert("   hello world   ", "snakeCase")).toBe("hello_world");
		});

		it("handles already converted strings", () => {
			expect(caseConvert("helloWorld", "camelCase")).toBe("helloWorld");
			expect(caseConvert("HelloWorld", "pascalCase")).toBe("HelloWorld");
		});
	});

	describe("stress: performance and stability", () => {
		it("stress: converts large strings repeatedly without errors", () => {
			const input = "VeryLongStringWithMultipleWords_and-Separators ".repeat(100);

			for (let i = 0; i < 1_000; i += 1) {
				const result = caseConvert(input, "camelCase");
				expect(result.length).toBeGreaterThan(0);
			}
		});

		it("stress: timing test", () => {
			const input = "hello world test string";
			const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

			const start = now();
			for (let i = 0; i < 50_000; i += 1) {
				void caseConvert(input, "kebabCase");
			}
			const durationMs = now() - start;

			console.info(`caseConvert stress duration: ${durationMs.toFixed(2)}ms`);
		});
	});
});
