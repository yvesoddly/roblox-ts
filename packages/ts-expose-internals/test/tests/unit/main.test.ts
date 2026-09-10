import { vi, type MockInstance } from "vite-plus/test";
import { run } from '../../../src/main';
import * as tsTagsModule from '../../../src/ts-tags';
import * as tsDeclarationsModule from '../../../src/ts-declarations';
import * as publishModule from '../../../src/publish';
import * as tmpDirModule from '../../../src/utils/tmp-dir';
import * as childProcess from 'child_process';
import fs from 'fs';

// mock the named builtin export used by execCmd, not the separate Node default export
vi.mock("child_process", async (importOriginal) => ({
  ...await importOriginal<typeof import("child_process")>(),
  execSync: () => Buffer.alloc(0),
}));

/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const storageFileData = {
  settings: { tsVersion: '1.0.0', skipTags: [], maxAttempts: 5, tsRepoUrl: 'repoUrl' },
  buildDetails: [
    { tsVersion: '1.1.0', tag: 'v1.1.0', attempts: 2, complete: false, lastAttempt: Date.now() },
    { tsVersion: '2.0.0', tag: 'v2.0.0', attempts: 3, complete: false, lastAttempt: Date.now() },
    { tsVersion: '2.1.0', tag: 'v2.1.0', attempts: 5, complete: false, lastAttempt: Date.now() },
  ]
};

// endregion


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('main.ts', () => {
  describe('run() - with versions', () => {
    let getApplicableTsTagsSpy: MockInstance;
    let buildTsDeclarationsSpy: MockInstance;
    let execSyncSpy: MockInstance;
    let fsExistsSyncSpy: MockInstance;
    let fsReadFileSyncSpy: MockInstance;
    let fsWriteFileSyncSpy: MockInstance;
    let publishSpy: MockInstance;
    let consoleErrorSpy: MockInstance;
    beforeAll(() => {
      fsExistsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      fsWriteFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { });
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      execSyncSpy = vi.spyOn(childProcess, 'execSync')
        .mockImplementation(() => Buffer.from(Math.random().toString(36).substring(2, 15)));

      publishSpy = vi.spyOn(publishModule, 'publish')
        .mockImplementationOnce(() => { })
        .mockImplementationOnce(() => { throw new Error('Publish failed'); })
        .mockImplementation(() => { });

      getApplicableTsTagsSpy = vi.spyOn(tsTagsModule, 'getApplicableTsTags')
        .mockReturnValue([ 'v1.1.0', 'v2.0.0', 'v3.0.0' ]);

      buildTsDeclarationsSpy = vi.spyOn(tsDeclarationsModule, 'buildTsDeclarations')
        .mockImplementation((_, tag) => ({ dtsContent: 'dtsContent', tsVersion: tag.replace(/^v/g, '') }));

      const originalReadFileSync = fs.readFileSync;
      fsReadFileSyncSpy = vi.spyOn(fs, 'readFileSync')
        .mockImplementation(function (this: any, p) {
          if (typeof p === "string" && p.endsWith('tsei-storage.json')) return JSON.stringify(storageFileData);
          return originalReadFileSync.apply(this, <any>arguments);
        });

      try {
        run(false);
      } catch (e) {
        expect(e.message).toContain('Finished with errors');
      }
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    test('Writes correct data to storage file', () => {
      expect(fsReadFileSyncSpy).toHaveBeenCalled();
      expect(fsWriteFileSyncSpy).toHaveBeenCalled();

      const writeArgs = fsWriteFileSyncSpy.mock.calls.slice(-1)[0][1];
      const storage = JSON.parse(writeArgs);

      expect(storage.settings).toEqual(storageFileData.settings);

      expect(storage.buildDetails).toHaveLength(4);

      expect(storage.buildDetails[0]).toEqual({
        tsVersion: '1.1.0',
        tag: 'v1.1.0',
        attempts: 3,
        complete: true,
        lastAttempt: expect.any(Number)
      });

      expect(storage.buildDetails[1]).toEqual({
        tsVersion: '2.0.0',
        tag: 'v2.0.0',
        attempts: 4,
        complete: false,
        lastAttempt: expect.any(Number)
      });

      expect(storage.buildDetails[2]).toEqual({
        tsVersion: '2.1.0',
        tag: 'v2.1.0',
        attempts: 5,
        complete: false,
        lastAttempt: expect.any(Number)
      });

      expect(storage.buildDetails[3]).toEqual({
        tsVersion: '3.0.0',
        tag: 'v3.0.0',
        attempts: 1,
        complete: true,
        lastAttempt: expect.any(Number)
      });
    });

    test('Checkpoints each attempt before starting the next build', () => {
      expect(fsWriteFileSyncSpy).toHaveBeenCalledTimes(4);
      const firstCheckpoint = JSON.parse(fsWriteFileSyncSpy.mock.calls[0][1]);
      expect(firstCheckpoint.buildDetails[0].complete).toBe(true);
      expect(fsWriteFileSyncSpy.mock.invocationCallOrder[0])
        .toBeLessThan(buildTsDeclarationsSpy.mock.invocationCallOrder[1]);
      const secondCheckpoint = JSON.parse(fsWriteFileSyncSpy.mock.calls[1][1]);
      expect(secondCheckpoint.buildDetails[1].complete).toBe(false);
    });

    test(`Skips build beyond maxAttempts`, () => {
      const writeArgs = fsWriteFileSyncSpy.mock.calls.slice(-1)[0][1];
      const storage = JSON.parse(writeArgs);

      const buildDetail = storage.buildDetails.find((bd: any) => bd.tsVersion === '2.1.0');
      expect(buildDetail.attempts).toEqual(5);
      expect(buildDetail.complete).toEqual(false);
    });

    test(`Commits and pushes changes`, () => {
      expect(execSyncSpy).toHaveBeenNthCalledWith(2, expect.stringMatching(/^git add .+?tsei-storage.json$/g), expect.any(Object));
      expect(execSyncSpy).toHaveBeenNthCalledWith(3, 'git commit --only -m "chore(storage): Updated storage" -- tsei-storage.json', expect.any(Object));
      expect(execSyncSpy).toHaveBeenNthCalledWith(5, 'git push', expect.any(Object));
    });

    test('Builds declarations and publishes them', () => {
      expect(buildTsDeclarationsSpy).toHaveBeenCalledTimes(3);
      expect(buildTsDeclarationsSpy).toHaveBeenNthCalledWith(1, 'repoUrl', 'v1.1.0', expect.any(String), true);
      expect(buildTsDeclarationsSpy).toHaveBeenNthCalledWith(2, 'repoUrl', 'v2.0.0', expect.any(String), true);
      expect(buildTsDeclarationsSpy).toHaveBeenNthCalledWith(3, 'repoUrl', 'v3.0.0', expect.any(String), true);

      expect(publishSpy).toHaveBeenCalledTimes(3);
      expect(publishSpy.mock.calls[0][0]).toEqual(expect.objectContaining({
        dryRun: false,
        currentBuild: {
          buildDetail: expect.objectContaining({
            tsVersion: '1.1.0',
            tag: 'v1.1.0',
          }),
          dtsContent: 'dtsContent',
        },
        repoRootDir: expect.any(String),
        storage: expect.objectContaining({
          settings: storageFileData.settings,
          buildDetails: expect.any(Array),
        })
      }));

      expect(publishSpy.mock.calls[1][0]).toEqual(expect.objectContaining({
        dryRun: false,
        currentBuild: {
          buildDetail: expect.objectContaining({
            tsVersion: '2.0.0',
            tag: 'v2.0.0',
          }),
          dtsContent: 'dtsContent',
        },
        repoRootDir: expect.any(String),
        storage: expect.objectContaining({
          settings: storageFileData.settings,
          buildDetails: expect.any(Array),
        })
      }));
      expect(publishSpy.mock.calls[2][0]).toEqual(expect.objectContaining({
        dryRun: false,
        currentBuild: {
          buildDetail: expect.objectContaining({
            tsVersion: '3.0.0',
            tag: 'v3.0.0',
          }),
          dtsContent: 'dtsContent',
        },
        repoRootDir: expect.any(String),
        storage: expect.objectContaining({
          settings: storageFileData.settings,
          buildDetails: expect.any(Array),
        })
      }));
    });

    test('Gracefully handles build failure', () => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toMatch('Publish failed');

      const writeArgs = fsWriteFileSyncSpy.mock.calls.slice(-1)[0][1];
      const storage = JSON.parse(writeArgs);

      // Find the 'v2.0.0' version build details
      const v2BuildDetails = storage.buildDetails.find((bd: any) => bd.tag === 'v2.0.0');

      expect(v2BuildDetails).toBeDefined();
      expect(v2BuildDetails.complete).toBe(false);
    });
  });

  describe('run() - dry run', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('Does not persist completed builds or run Git commands', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(storageFileData));
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const execSpy = vi.spyOn(childProcess, 'execSync').mockReturnValue('');
      vi.spyOn(tmpDirModule, 'withTmpDir').mockImplementation((_, fn) => fn('/tmp/build'));
      vi.spyOn(tsTagsModule, 'getApplicableTsTags').mockReturnValue(['v1.1.0']);
      vi.spyOn(tsDeclarationsModule, 'buildTsDeclarations').mockReturnValue({
        dtsContent: 'declarations', tsVersion: '1.1.0',
      });
      const publishSpy = vi.spyOn(publishModule, 'publish').mockImplementation(() => {});

      run(true);

      expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
      expect(writeSpy).not.toHaveBeenCalled();
      expect(execSpy).not.toHaveBeenCalled();
    });
  });

  describe('run() - no versions to process', () => {
    let getApplicableTsTagsSpy: MockInstance;
    let execSyncSpy: MockInstance;
    let withTmpDirSpy: MockInstance;
    let consoleLogSpy: MockInstance;
    let result: any;

    beforeAll(() => {
      execSyncSpy = vi.spyOn(childProcess, 'execSync').mockReturnValue('');
      getApplicableTsTagsSpy = vi.spyOn(tsTagsModule, 'getApplicableTsTags').mockReturnValue([]);
      withTmpDirSpy = vi.spyOn(tmpDirModule, 'withTmpDir').mockImplementation(vi.fn());
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());

      // noinspection JSVoidFunctionReturnValueUsed
      result = run(true);
      expect(getApplicableTsTagsSpy).toHaveBeenCalled();
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    test('Logs info message', () => {
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toMatch('No new versions to build!');
    });

    test('Does not process any logic', () => {
      expect(execSyncSpy).not.toHaveBeenCalled();
      expect(withTmpDirSpy).not.toHaveBeenCalled();
    });

    test('Exits gracefully', () => {
      expect(result).toBeUndefined();
    });
  });
});

// endregion
