import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadMarketImageUseCase } from '@/application/use-cases/admin/upload-market-image';
import { SupabaseClient } from '@supabase/supabase-js';

describe('UploadMarketImageUseCase', () => {
  let useCase: UploadMarketImageUseCase;
  let mockSupabase: any;
  let mockStorage: any;
  let mockFrom: any;

  beforeEach(() => {
    mockStorage = {
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
    };
    mockFrom = vi.fn().mockReturnValue(mockStorage);
    mockSupabase = {
      storage: {
        from: mockFrom,
      },
    } as unknown as SupabaseClient;

    useCase = new UploadMarketImageUseCase(mockSupabase);
  });

  it('should upload file successfully', async () => {
    const mockFile = {
      mimetype: 'image/jpeg',
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
    } as any;

    mockStorage.upload.mockResolvedValue({ data: { path: 'path' }, error: null });
    mockStorage.getPublicUrl.mockReturnValue({ data: { publicUrl: 'http://example.com/image.jpg' } });

    const result = await useCase.execute({ file: mockFile });

    expect(result.url).toBe('http://example.com/image.jpg');
    expect(mockFrom).toHaveBeenCalledWith('markets');
    expect(mockStorage.upload).toHaveBeenCalled();
  });

  it('should throw error for invalid mimetype', async () => {
    const mockFile = {
      mimetype: 'application/pdf',
    } as any;

    await expect(useCase.execute({ file: mockFile }))
      .rejects
      .toThrow('Invalid file type');
  });

  it('should throw error if upload fails', async () => {
    const mockFile = {
      mimetype: 'image/jpeg',
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
    } as any;

    mockStorage.upload.mockResolvedValue({ data: null, error: { message: 'Storage error' } });

    await expect(useCase.execute({ file: mockFile }))
      .rejects
      .toThrow('Upload failed: Storage error');
  });
});
