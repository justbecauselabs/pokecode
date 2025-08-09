import { describe, it, expect, beforeAll } from 'bun:test';
import { FileService } from '@/services/file.service';
import { AuthorizationError, ValidationError } from '@/types';

describe('FileService.validatePath', () => {
  let svc: FileService;

  beforeAll(() => {
    svc = new FileService();
  });

  it('accepts absolute session paths and resolves correctly', async () => {
    const resolved = await svc.validatePath('/abs/session', 'file.txt');
    expect(resolved).toBe('/abs/session/file.txt');
  });

  it('rejects traversal in requested path', async () => {
    await expect(svc.validatePath('proj', '../secret.txt')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('resolves valid relative paths under base', async () => {
    const resolved = await svc.validatePath('proj/sub', 'file.txt');
    // Should end with .../proj/sub/file.txt
    expect(resolved.endsWith('/proj/sub/file.txt') || resolved.endsWith('\\proj\\sub\\file.txt')).toBe(true);
  });

  it('prevents escaping baseDir using crafted segments', async () => {
    await expect(svc.validatePath('proj', 'a/../../b.txt')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
