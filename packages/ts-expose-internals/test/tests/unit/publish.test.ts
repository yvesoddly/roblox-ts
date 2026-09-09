import { vi, type MockInstance } from "vite-plus/test";
import fs from 'fs';
import * as childProcess from 'child_process';
import { TseiContext } from '../../../src/context';
import { publish } from '../../../src/publish';
import { BuildDetail } from '../../../src/storage';
import path from 'path';
import * as tmpDirModule from '../../../src/utils/tmp-dir';

// mock the named builtin export used by execCmd, not the separate Node default export
vi.mock("child_process", async (importOriginal) => ({
  ...await importOriginal<typeof import("child_process")>(),
  execSync: () => Buffer.alloc(0),
}));

/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const buildDetail = {
  tag: 'v1.2.3',
  tsVersion: '1.2.3',
} as BuildDetail;

const dtsContent = 'content';

const context = {
  currentBuild: {
    dtsContent,
    buildDetail
  },
  repoRootDir: '/root/dir',
  storage: {
    buildDetails: [] as BuildDetail[]
  }
} as TseiContext;

const destDir = '/tmp/publish';

// endregion


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe(`publish.ts`, () => {
  describe.each([ { dryRun: true }, { dryRun: false } ])(`publish() %s`, ({ dryRun }) => {
    let readDirSyncSpy: MockInstance;
    let copyFileSyncSpy: MockInstance;
    let readFileSyncSpy: MockInstance;
    let writeFileSyncSpy: MockInstance;
    let execSyncSpy: MockInstance;
    let withTmpDirSpy: MockInstance;

    beforeAll(() => {
      readDirSyncSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([ 'file1', 'file2' ] as any);
      readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
        if ((p as string).endsWith('package.json')) return JSON.stringify({ version: '0.0.0', private: true });
        return '';
      });
      writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(vi.fn());
      execSyncSpy = vi.spyOn(childProcess, 'execSync').mockImplementation(vi.fn());
      copyFileSyncSpy = vi.spyOn(fs, 'copyFileSync').mockImplementation(vi.fn());
      withTmpDirSpy = vi.spyOn(tmpDirModule, 'withTmpDir').mockImplementation((p, fn) => fn('/tmp/' + p));

      publish({ ...context, dryRun });
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    test(`Copies package files`, () => {
      expect(readDirSyncSpy).toHaveBeenCalledWith(path.normalize('/root/dir/package-files'));
      expect(copyFileSyncSpy).toHaveBeenCalledTimes(3);
      expect(copyFileSyncSpy).toHaveBeenNthCalledWith(1, path.normalize('/root/dir/package-files/file1'), path.normalize('/tmp/publish/file1'));
      expect(copyFileSyncSpy).toHaveBeenNthCalledWith(2, path.normalize('/root/dir/package-files/file2'), path.normalize('/tmp/publish/file2'));
      expect(copyFileSyncSpy).toHaveBeenNthCalledWith(3, path.normalize('/root/dir/README.md'), path.normalize('/tmp/publish/README.md'));
    });

    test('Writes DTS file', () => {
      expect(writeFileSyncSpy).toHaveBeenCalledWith(path.normalize('/tmp/publish/typescript.d.ts'), dtsContent);
    });

    test(`Publishes package ${dryRun ? '(with dry run)' : ''}`, () => {
      expect(execSyncSpy).toHaveBeenCalledWith(
        `npm publish --ignore-scripts --tag "latest"${dryRun ? ' --dry-run' : ''}`,
        expect.objectContaining({
          cwd: destDir,
        })
      );
    });

    test('Writes updated package.json file', () => {
      const writeCall = writeFileSyncSpy.mock.calls.find((c) => c[0].endsWith('package.json'));
      const writtenPkgJson = JSON.parse(writeCall![1]);
      expect(writtenPkgJson).toMatchObject({ version: buildDetail.tsVersion });
      expect(writtenPkgJson).not.toHaveProperty('private');
    });
    test.each([
      ['1.1.0', '1.2.0', 'backfill'],
      ['1.2.0', '1.2.0', 'backfill'],
      ['1.3.0', '1.2.0', 'latest'],
      ['1.3.0', '1.4.0-beta.1', 'latest'],
      ['1.3.0-beta.1', '1.2.0', 'beta'],
      ['1.3.0-dev.20260909', '1.2.0', 'dev'],
      ['1.3.0-rc.1', '1.2.0', 'rc'],
      ['1.3.0-beta', '1.2.0', 'beta'],
    ])('Publishes %s after %s using %s', (version, previousVersion, tag) => {
      execSyncSpy.mockClear();
      publish({
        ...context,
        dryRun,
        currentBuild: {
          dtsContent,
          buildDetail: { ...buildDetail, tsVersion: version, tag: `v${version}` },
        },
        storage: {
          ...context.storage,
          buildDetails: [{ ...buildDetail, tsVersion: previousVersion, complete: true }],
        },
      });
      expect(execSyncSpy).toHaveBeenCalledWith(
        `npm publish --ignore-scripts --tag "${tag}"${dryRun ? ' --dry-run' : ''}`,
        expect.objectContaining({ cwd: destDir }),
      );
    });
  });
});

// endregion
