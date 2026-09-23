import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as CliError from "effect/unstable/cli/CliError";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { ProjectBuild, type ProjectOptions } from "roblox-ts";
import { setupProjectWatchProgram } from "roblox-ts/out/Project/functions/setupProjectWatchProgram.js";
import { LogService } from "roblox-ts/out/Shared/classes/LogService.js";
import { ProjectType } from "roblox-ts/out/Shared/constants.js";
import { LoggableError } from "roblox-ts/out/Shared/errors/LoggableError.js";
import { hasErrors } from "roblox-ts/out/Shared/util/hasErrors.js";
import ts from "typescript";

import { findTsConfigPath } from "../findTsConfigPath.js";

const buildFlags = {
	project: Flag.string("project").pipe(
		Flag.withAlias("p"),
		Flag.withDescription("project path"),
		Flag.withDefault("."),
	),
	// absent overrides must leave DEFAULT_PROJECT_OPTIONS and tsconfig rbxts options intact
	watch: Flag.boolean("watch").pipe(
		Flag.withAlias("w"),
		Flag.withDescription("enable watch mode"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	usePolling: Flag.boolean("use-polling").pipe(
		Flag.withDescription("use polling for watch mode"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	verbose: Flag.boolean("verbose").pipe(
		Flag.withDescription("enable verbose logs"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	noInclude: Flag.boolean("no-include").pipe(
		Flag.withDescription("do not copy include files"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	logTruthyChanges: Flag.boolean("log-truthy-changes").pipe(
		Flag.withDescription("logs changes to truthiness evaluation from Lua truthiness rules"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	writeOnlyChanged: Flag.boolean("write-only-changed").pipe(
		Flag.withHidden,
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	writeTransformedFiles: Flag.boolean("write-transformed-files").pipe(
		Flag.withDescription("writes resulting TypeScript ASTs after transformers to out directory"),
		Flag.withHidden,
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	optimizedLoops: Flag.boolean("optimized-loops").pipe(
		Flag.withHidden,
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	type: Flag.choice("type", [ProjectType.Game, ProjectType.Model, ProjectType.Package]).pipe(
		Flag.withDescription("override project type"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	includePath: Flag.string("include-path").pipe(
		Flag.withAlias("i"),
		Flag.withDescription("folder to copy runtime files to"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	rojo: Flag.string("rojo").pipe(
		Flag.withDescription("manually select Rojo project file"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	allowCommentDirectives: Flag.boolean("allow-comment-directives").pipe(
		Flag.withHidden,
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
	luau: Flag.boolean("luau").pipe(
		Flag.withDescription("emit files with .luau extension"),
		Flag.optional,
		Flag.map(Option.getOrUndefined),
	),
};

class ReportedBuildError extends Data.TaggedError("ReportedBuildError") {
	// rc.112 uses false to suppress a runtime log for an already-reported failure
	readonly [Runtime.errorReported] = false;
}

// compiler diagnostics keep their existing formatting; unexpected exceptions remain defects
const compilerSync = Effect.fn("compilerSync")(function* <A>(evaluate: () => A) {
	try {
		return evaluate();
	} catch (error) {
		if (error instanceof LoggableError) {
			error.log();
			return yield* new ReportedBuildError();
		}
		return yield* Effect.die(error);
	}
});

const build = Effect.fn("build")(function* ({ project, ...overrides }: { project: string } & Partial<ProjectOptions>) {
	// polling requires an explicit watch flag, even when either flag is false
	if (overrides.usePolling !== undefined && overrides.watch === undefined) {
		return yield* new CliError.UserError({ cause: "Missing dependent arguments:\n use-polling -> watch" });
	}

	const tsConfigPath = yield* findTsConfigPath(project);
	const projectBuild = yield* Effect.acquireRelease(
		compilerSync(() => new ProjectBuild(tsConfigPath, overrides)),
		projectBuild => Effect.sync(() => projectBuild.close()),
	);
	const projectOptions = projectBuild.graph.root.data.projectOptions;
	LogService.verbose = projectOptions.verbose;

	if (projectOptions.watch) {
		yield* Effect.acquireRelease(
			compilerSync(() => setupProjectWatchProgram(projectBuild, projectOptions.usePolling)),
			watch => Effect.promise(() => watch.close()),
		);
		return yield* Effect.never;
	}

	const result = yield* compilerSync(() => projectBuild.build());
	const diagnosticReporter = ts.createDiagnosticReporter(ts.sys, true);
	for (const diagnostic of result.diagnostics) {
		diagnosticReporter(diagnostic);
	}

	if (hasErrors(result.diagnostics)) {
		return yield* new ReportedBuildError();
	}
}, Effect.scoped);

export const BuildCommand = Command.make("build", buildFlags, build).pipe(Command.withDescription("Build a project"));
