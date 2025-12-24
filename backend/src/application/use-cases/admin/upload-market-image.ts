import { MultipartFile } from '@fastify/multipart';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { ValidationError, BusinessLogicError } from '../../../domain/errors/domain-error';

export interface UploadMarketImageRequest {
  file: MultipartFile;
}

export interface UploadMarketImageResponse {
  url: string;
}

export class UploadMarketImageUseCase {
  constructor(private readonly supabase: SupabaseClient) { }

  async execute(request: UploadMarketImageRequest): Promise<UploadMarketImageResponse> {
    const { file } = request;

    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
    }

    // Generate unique path
    const ext = file.mimetype.split('/')[1];
    const filename = `${randomUUID()}.${ext}`;
    const filePath = `markets/${filename}`;

    const fileBuffer = await file.toBuffer();

    const { error: uploadError } = await this.supabase.storage
      .from('markets')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BusinessLogicError(`Upload failed: ${uploadError.message}`, 'UPLOAD_FAILED');
    }

    const { data: publicUrlData } = this.supabase.storage
      .from('markets')
      .getPublicUrl(filePath);

    // Check if the URL is valid/bucket is public? 
    // Usually getPublicUrl just returns the string regardless of bucket public setting.
    // We assume bucket is public as per plan.

    return { url: publicUrlData.publicUrl };
  }
}
