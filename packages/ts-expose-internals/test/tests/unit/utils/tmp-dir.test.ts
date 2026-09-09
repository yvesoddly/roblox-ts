import { withTmpDir, getTmpDir } from '../../../../src/utils/tmp-dir';
import fs from 'fs';
import path from 'path';
import os from 'os';


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('utils/tmp-dir.ts', () => {
  describe('getTmpDir(', () => {
    test('Return a valid tmp directory path', () => {
      const tmpDir = getTmpDir('test');
      const expectedDir = path.join(os.tmpdir(), 'tsei', 'test');

      expect(tmpDir).toEqual(expectedDir);
    });
  });

  describe('withTmpDir()', () => {
    test('Creates and deletes the directory', () => {
      const tmpDirName = 'test';

      let tmpDir: string | null = null;
      withTmpDir(tmpDirName, (dir) => {
        tmpDir = dir;
        // Check if directory exists
        expect(fs.existsSync(tmpDir)).toBeTruthy();
      });

      // Check if directory was deleted
      expect(fs.existsSync(tmpDir!)).toBeFalsy();
    });

    test('Overlapping invocations with the same name preserve each other', () => {
      withTmpDir('test', outer => {
        const marker = path.join(outer, 'active');
        fs.writeFileSync(marker, 'outer');
        const innerDir = withTmpDir('test', inner => {
          expect(inner).not.toBe(outer);
          expect(fs.readFileSync(marker, 'utf8')).toBe('outer');
          return inner;
        });

        expect(fs.existsSync(innerDir)).toBe(false);
        expect(fs.readFileSync(marker, 'utf8')).toBe('outer');
      });
    });

    test('Returns the result of the function argument', () => {
      const result = withTmpDir('test', () => 'success');
      expect(result).toEqual('success');
    });

    test('Delete the directory even if the function argument throws an error', () => {
      const tmpDirName = 'test';

      let tmpDir: string | null = null;
      try {
        withTmpDir(tmpDirName, (dir) => {
          tmpDir = dir;
          throw new Error('Test error');
        });
      } catch (err) {
        // Check if directory was deleted
        expect(fs.existsSync(tmpDir!)).toBeFalsy();
      }
    });
  });
});

// endregion
