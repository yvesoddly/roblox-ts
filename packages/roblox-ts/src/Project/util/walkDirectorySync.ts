import path from "path";

import fs from "fs-extra";

/**
 * Recursively calls the callback on all descendant directories and files
 */
export function walkDirectorySync(dir: string, callback: (fsPath: string) => void) {
  const queue = [dir];
  for (let i = 0; i < queue.length; i++) {
    const currentDir = queue[i];
    for (const child of fs.readdirSync(currentDir)) {
      const fsPath = path.join(currentDir, child);
      callback(fsPath);
      if (fs.statSync(fsPath).isDirectory()) {
        queue.push(fsPath);
      }
    }
  }
}
