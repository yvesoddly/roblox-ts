import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { getStorage } from "../../../src/storage";

test("Release commits preserve unrelated staged files in a checkout with spaces", () => {
	const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsei git storage "));
	const git = (...args: Array<string>) => execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();

	try {
		git("init");
		git("config", "user.name", "Storage Test");
		git("config", "user.email", "storage@example.invalid");
		git("config", "commit.gpgsign", "false");
		git("config", "core.hooksPath", path.join(repoDir, ".git", "disabled-hooks"));
		fs.writeFileSync(path.join(repoDir, "tsei-storage.json"), JSON.stringify({ settings: {}, buildDetails: [] }));
		fs.writeFileSync(path.join(repoDir, "unrelated.txt"), "original");
		git("add", ".");
		git("commit", "-m", "Initial state");
		fs.writeFileSync(path.join(repoDir, "unrelated.txt"), "staged change");
		git("add", "unrelated.txt");
		const storage = getStorage(repoDir);
		storage.buildDetails.push({
			tsVersion: "5.9.3",
			tag: "v5.9.3",
			attempts: 1,
			complete: true,
			lastAttempt: 0,
		});

		const commitId = storage.save();

		expect(git("rev-parse", "HEAD")).toBe(commitId);
		expect(git("show", "--pretty=format:", "--name-only", "HEAD")).toBe("tsei-storage.json");
		expect(git("diff", "--cached", "--name-only")).toBe("unrelated.txt");
	} finally {
		fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 3 });
	}
}, 30_000);
