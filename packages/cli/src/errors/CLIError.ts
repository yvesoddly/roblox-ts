import { DiagnosticError } from "roblox-ts/out/Shared/errors/DiagnosticError";
import { createTextDiagnostic } from "roblox-ts/out/Shared/util/createTextDiagnostic";

export class CLIError extends DiagnosticError {
	constructor(message: string) {
		super([createTextDiagnostic(message)]);
	}
}
