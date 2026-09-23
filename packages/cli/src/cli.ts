#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import * as Command from "effect/unstable/cli/Command";
import { COMPILER_VERSION } from "roblox-ts";

import { BuildCommand } from "./commands/build.js";

const cli = Command.make("rbxtsc").pipe(
	Command.withDescription("A TypeScript-to-Luau compiler for Roblox"),
	Command.withSubcommands([BuildCommand]),
);

function flushOutput(stream: NodeJS.WriteStream, onFlushed: () => void) {
	if (stream.writableLength === 0) {
		onFlushed();
	} else {
		stream.write("", onFlushed);
	}
}

Command.run(cli, { version: COMPILER_VERSION }).pipe(
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain({
		teardown(exit, onExit) {
			// NodeRuntime exits immediately on failure; flush after finalizers and runtime error reporting
			flushOutput(process.stdout, () => {
				flushOutput(process.stderr, () => Runtime.defaultTeardown(exit, onExit));
			});
		},
	}),
);
