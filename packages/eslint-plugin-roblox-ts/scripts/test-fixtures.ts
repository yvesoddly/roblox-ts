#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

interface ESLintMessage {
	column: number;
	fatal?: boolean;
	line: number;
	message: string;
	ruleId?: string;
	severity: number;
}

interface ESLintResult {
	errorCount: number;
	filePath: string;
	messages: Array<ESLintMessage>;
	warningCount: number;
}

interface FixtureTest {
	name: string;
	version: string;
}

interface TestResult {
	name: string;
	details?: string;
	duration?: number;
	passed: boolean;
}

/**
 * Extract and analyze roblox-ts messages from ESLint results.
 *
 * @param results - ESLint results array.
 * @returns Object with all messages and filtered roblox-ts messages.
 */
function analyzeESLintResults(results: Array<ESLintResult>) {
	const allMessages = results.flatMap((result) => result.messages);
	const robloxTsMessages = allMessages.filter(
		(message) => message.ruleId?.startsWith("roblox-ts/") ?? false,
	);

	return { allMessages, robloxTsMessages };
}

const testResults: Array<TestResult> = [];

/**
 * Handle ESLint execution error for fixtures.
 *
 * @param err - The error from ESLint execution.
 * @param fixtureName - Name of the fixture being tested.
 * @returns True if error handling succeeded, false otherwise.
 */
function handleFixtureError(err: unknown, fixtureName: string): boolean {
	const stdout = (err as { stdout?: string }).stdout ?? "";

	if (stdout.trim() === "") {
		testResults.push({
			name: `${fixtureName} fixture`,
			details: err instanceof Error ? err.message : "No ESLint output received",
			passed: false,
		});
		return false;
	}

	try {
		const results = parseESLintResults(stdout);
		return validateResults(results, fixtureName);
	} catch (err_) {
		const errorMessage = err_ instanceof Error ? err_.message : String(err_);
		testResults.push({
			name: `${fixtureName} fixture`,
			details: `Invalid ESLint output: ${errorMessage}`,
			passed: false,
		});
		return false;
	}
}

/** Main test function that runs all fixture tests. */
function main(): never {
	const startTime = Date.now();

	const fixtures: Array<FixtureTest> = [
		{ name: "eslint-plugin-roblox-ts-fixture-v8", version: "v8" },
		{ name: "eslint-plugin-roblox-ts-fixture-v9", version: "v9" },
		{ name: "eslint-plugin-roblox-ts-fixture-v10", version: "v10" },
	];

	let allPassed = true;

	for (const { name, version } of fixtures) {
		const fixturesPassed = testFixture(name, version);
		const constraintPassed = testFileConstraint(name, version);

		if (!fixturesPassed || !constraintPassed) {
			allPassed = false;
		}
	}

	const duration = Date.now() - startTime;
	printTestSummary(allPassed, duration);

	process.exit(allPassed ? 0 : 1);
}

function parseESLintResults(stdout: string): Array<ESLintResult> {
	const results = JSON.parse(stdout) as Array<ESLintResult>;
	assert.ok(results.length > 0, "Expected ESLint results for the fixture");

	// parse failures skip rules and cannot establish their behavior
	const { allMessages } = analyzeESLintResults(results);
	const fatalMessages = allMessages.filter((message) => message.fatal === true);
	assert.equal(
		fatalMessages.length,
		0,
		fatalMessages.map((message) => message.message).join("\n"),
	);

	return results;
}

/**
 * Display a formatted summary of test results including pass/fail status,
 * individual test outcomes, and execution time.
 *
 * @param allPassed - Whether all tests passed.
 * @param duration - Test duration in milliseconds.
 */
function printTestSummary(allPassed: boolean, duration: number): void {
	const status = allPassed ? "PASS" : "FAIL";
	console.log(`${status}  fixture tests`);
	console.log("");

	for (const result of testResults) {
		const symbol = result.passed ? "✓" : "✗";
		const details = result.details !== undefined ? ` (${result.details})` : "";
		console.log(`${symbol} ${result.name}${details}`);
	}

	console.log("");

	const passed = testResults.filter((result) => result.passed).length;
	const total = testResults.length;
	const failed = total - passed;

	if (allPassed) {
		console.log(`Tests: ${passed} passed, ${total} total`);
	} else {
		console.log(`Tests: ${failed} failed, ${passed} passed, ${total} total`);
	}

	console.log(`Time:  ${(duration / 1000).toFixed(1)}s`);
}

/**
 * Record a constraint test failure.
 *
 * @param robloxTsMessages - Array of roblox-ts rule violation messages.
 * @param fixtureName - Name of the fixture being tested.
 */
function recordConstraintFailure(
	robloxTsMessages: Array<ESLintMessage>,
	fixtureName: string,
): void {
	const triggeredRules = robloxTsMessages
		.map((message) => message.ruleId)
		.filter((ruleId): ruleId is string => ruleId !== undefined);
	const details = `Root-level file triggered ${robloxTsMessages.length} roblox-ts rules: ${triggeredRules.join(", ")}`;
	testResults.push({
		name: `${fixtureName} file constraints`,
		details,
		passed: false,
	});
}

/**
 * Record a constraint test success.
 *
 * @param fixtureName - Name of the fixture being tested.
 */
function recordConstraintSuccess(fixtureName: string): void {
	testResults.push({
		name: `${fixtureName} file constraints`,
		passed: true,
	});
}

function runESLint(eslintVersion: string, file: string): string {
	const eslintManifestSpecifier = "eslint/package.json";
	const fixtureDirectory = resolve("fixtures", `eslint-${eslintVersion}`);
	const fixtureRequire = createRequire(join(fixtureDirectory, "package.json"));
	const eslintManifest = fixtureRequire.resolve(eslintManifestSpecifier);
	const { version } = fixtureRequire(eslintManifestSpecifier) as { version: string };
	assert.equal(`v${version.split(".")[0]}`, eslintVersion);

	const pluginRequire = createRequire(fixtureRequire.resolve("eslint-plugin-roblox-ts"));
	assert.equal(pluginRequire.resolve(eslintManifestSpecifier), eslintManifest);
	assert.equal(
		pluginRequire.resolve("@typescript-eslint/parser"),
		fixtureRequire.resolve("@typescript-eslint/parser"),
	);

	return execFileSync(
		process.execPath,
		[join(dirname(eslintManifest), "bin", "eslint.js"), file, "--format", "json"],
		{ cwd: fixtureDirectory, encoding: "utf8", stdio: "pipe" },
	);
}

function testFileConstraint(fixtureName: string, eslintVersion: string): boolean {
	try {
		const stdout = runESLint(eslintVersion, "config-test.ts");
		return validateConstraintResults(stdout, fixtureName);
	} catch (err) {
		const stdout = (err as { stdout?: string }).stdout ?? "";
		return validateConstraintResults(stdout, fixtureName);
	}
}

function testFixture(fixtureName: string, eslintVersion: string): boolean {
	try {
		runESLint(eslintVersion, "src/**/*.ts");
		// If ESLint succeeds (no errors), that's unexpected for our test fixtures
		testResults.push({
			name: `${fixtureName} fixture`,
			details: "Expected violations but none were found",
			passed: false,
		});
		return false;
	} catch (err) {
		// ESLint failed (found errors) - this is expected!
		return handleFixtureError(err, fixtureName);
	}
}

/**
 * Validate constraint test results to ensure no roblox-ts rules were triggered.
 *
 * @param stdout - ESLint output to validate.
 * @param fixtureName - Name of the fixture being tested.
 * @returns True if constraint validation passed, false otherwise.
 */
function validateConstraintResults(stdout: string, fixtureName: string): boolean {
	if (stdout.trim() === "") {
		testResults.push({
			name: `${fixtureName} file constraints`,
			details: "No ESLint output received",
			passed: false,
		});
		return false;
	}

	try {
		const results = parseESLintResults(stdout);
		const { robloxTsMessages } = analyzeESLintResults(results);

		if (robloxTsMessages.length > 0) {
			recordConstraintFailure(robloxTsMessages, fixtureName);
			return false;
		}

		recordConstraintSuccess(fixtureName);
		return true;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		testResults.push({
			name: `${fixtureName} file constraints`,
			details: `Invalid ESLint output: ${errorMessage}`,
			passed: false,
		});
		return false;
	}
}

/**
 * Validate ESLint results contain expected violations.
 *
 * @param results - ESLint results array.
 * @param fixtureName - Name of the fixture being tested.
 * @returns True if validation passed, false otherwise.
 */
function validateResults(results: Array<ESLintResult>, fixtureName: string): boolean {
	const { robloxTsMessages } = analyzeESLintResults(results);

	if (robloxTsMessages.length === 0) {
		testResults.push({
			name: `${fixtureName} fixture`,
			details: "No roblox-ts rule violations found",
			passed: false,
		});
		return false;
	}

	// Success if we found roblox-ts violations
	const details = `${robloxTsMessages.length} roblox-ts violations found`;
	testResults.push({
		name: `${fixtureName} fixture`,
		details,
		passed: true,
	});

	return true;
}

main();
