/**
 * Media API
 *
 * Maps to the Media endpoints from the backend:
 * - POST /api/v1/media/upload (Upload File)
 * - DELETE /api/v1/media (Delete File)
 */

import { createApiClient } from './client';

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface UploadFileResponse {
  success: boolean;
  data: UploadedFile;
  message?: string;
}

export interface DeleteFileRequest {
  url: string;
}

export interface DeleteFileResponse {
  success: boolean;
  message?: string;
}

/**
 * Upload a media file
 * POST /api/v1/media/upload
 * Requires: Bearer token
 * Content-Type: multipart/form-data
 */
export const uploadFile = async (
  token: string,
  file: File
): Promise<UploadedFile> => {
  const client = createApiClient(token);
  const formData = new FormData();
  formData.append('file', file);

  const response = await client.post<UploadFileResponse>(
    '/api/v1/media/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data.data;
};

/**
 * Delete a previously uploaded file
 * DELETE /api/v1/media
 * Requires: Bearer token
 */
export const deleteFile = async (
  token: string,
  fileUrl: string
): Promise<void> => {
  const client = createApiClient(token);
  await client.delete<DeleteFileResponse>('/api/v1/media', {
    data: { url: fileUrl },
  });
};
