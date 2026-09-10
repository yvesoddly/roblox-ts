import { vi, type MockInstance } from "vite-plus/test";
import { createContext } from '../../../src/context';
import * as storageModule from '../../../src/storage';


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('context.ts', () => {
  let getStorageSpy: MockInstance;
  beforeAll(() => {
    getStorageSpy = vi.spyOn(storageModule, 'getStorage').mockImplementation(vi.fn());
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('createContext', () => {
    test('Returns a TseiContext object with the specified repo root dir and storage', () => {
      const repoRootDir = '/test/repo/root/dir';
      const mockStorage = {};
      getStorageSpy.mockReturnValue(mockStorage);

      const context = createContext(repoRootDir);

      expect(context.repoRootDir).toEqual(repoRootDir);
      expect(context.storage).toEqual(mockStorage);
    });

    test('Defaults repoRootDir to process.cwd() if not provided', () => {
      const mockStorage = {};
      getStorageSpy.mockReturnValue(mockStorage);

      const context = createContext();

      expect(context.repoRootDir).toEqual(process.cwd());
      expect(context.storage).toEqual(mockStorage);
    });
  });
});

// endregion
