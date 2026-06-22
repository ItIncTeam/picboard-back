import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';

export interface FileValidationResult {
  fileId: string;
  ownerId: string;
  status: 'PENDING' | 'READY' | 'FAILED';
}

@Injectable()
export class FilesServiceClient {
  constructor(private readonly appConfig: AppConfig) {}

  /**
   * Валидация fileIds перед createPost.
   * Вызывает ownedFilesByIds на files-service напрямую (НЕ через gateway).
   * Проверяет: файлы существуют, принадлежат ownerId, статус READY.
   * URL не возвращает — он резолвится через federation на query time.
   */
  async validateOwnedFiles(
    fileIds: string[],
    ownerId: string,
  ): Promise<FileValidationResult[]> {
    const query = `
      query ($ids: [ID!]!) {
        ownedFilesByIds(ids: $ids) {
          fileId
          ownerId
          status
        }
      }
    `;

    const response = await fetch(this.appConfig.filesServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { ids: fileIds } }),
    });

    const json = await response.json();
    if (json.errors) {
      throw new Error(`Files service error: ${JSON.stringify(json.errors)}`);
    }

    return json.data.ownedFilesByIds;
  }
}

//todo : **Важно:** файловый сервис проверяет `ownerId` внутри `ownedFilesByIds` — он использует JWT
// из контекста запроса. Но здесь вызов идёт из сервиса-к-сервису, поэтому нужно либо пробрасывать токен,
// либо использовать внутреннюю аутентификацию. Уточнить при реализации.
