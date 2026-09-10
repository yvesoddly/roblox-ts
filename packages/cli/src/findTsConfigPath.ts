import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as CliError from "effect/unstable/cli/CliError";

const isFile = Effect.fn("isFile")(function* (filePath: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.stat(filePath).pipe(
		Effect.map(info => info.type === "File"),
		Effect.catch(error =>
			Match.value(error.reason).pipe(
				Match.when({ _tag: "NotFound" }, () => Effect.succeed(false)),
				// a missing descendant can pass through a file rather than a directory
				Match.when({ _tag: "BadResource", cause: { code: "ENOTDIR" } }, () => Effect.succeed(false)),
				Match.orElse(() => Effect.fail(error)),
			),
		),
	);
});

export const findTsConfigPath = Effect.fn("findTsConfigPath")(function* (projectPath: string) {
	const path = yield* Path.Path;
	const absolutePath = path.resolve(projectPath);
	if (yield* isFile(absolutePath)) {
		return absolutePath;
	}

	let directory = absolutePath;
	while (true) {
		const candidate = path.join(directory, "tsconfig.json");
		if (yield* isFile(candidate)) {
			return candidate;
		}

		const parent = path.dirname(directory);
		if (parent === directory) {
			return yield* new CliError.UserError({ cause: "Unable to find tsconfig.json!" });
		}
		directory = parent;
	}
});
