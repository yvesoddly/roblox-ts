import fs from 'fs';
import path from 'path';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function copyRecursive(filePath: string, destPath: string) {
  const stats = fs.statSync(filePath);
  if (stats.isDirectory()) {
    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
    fs.readdirSync(filePath).forEach((item) => {
      copyRecursive(path.join(filePath, item), path.join(destPath, item));
    });
  } else {
    fs.copyFileSync(filePath, destPath);
  }
}

// resolve each dependency before linking so pnpm's relative links also work across Windows drives
export function linkNodeModules(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.startsWith('.')) {
      continue;
    }

    const source = path.join(srcDir, name);
    const destination = path.join(destDir, name);
    if (name.startsWith('@')) {
      linkNodeModules(source, destination);
    } else {
      fs.symlinkSync(fs.realpathSync(source), destination, 'junction');
    }
  }
}

export function rmDir(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (!fs.lstatSync(curPath).isSymbolicLink()) {
        if (fs.lstatSync(curPath).isDirectory()) {
          fs.rmSync(curPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(curPath);
        }
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// endregion
