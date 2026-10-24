import { BadRequestException, Injectable } from '@nestjs/common';
import { ValidationErrorItem } from '@app/common';
import { InitiateUploadInput } from '../../graphql/inputs/initiate-upload.input';
import { PURPOSE_UPLOAD_RULES } from '../../files/files.constants';

// Applies PURPOSE_UPLOAD_RULES to an initiateUploadBatch request. Called by the
// use case before any row is written or URL signed. These checks depend on the
// purpose and on the batch as a whole, which per-field DTO decorators can't
// express cleanly.
// Errors use the same { message, errors: [{ field, message }] } shape as
// createValidationPipe, so the frontend handles both the same way.
@Injectable()
export class FileUploadPolicyService {
  validateBatch(items: InitiateUploadInput[]): void {
    if (!items.length) {
      this.reject('input', 'At least one file is required');
    }

    // the strictest purpose in the batch sets the limit, so a batch that
    // contains an avatar can only contain that avatar
    const maxFiles = Math.min(
      ...items.map(
        (item) => PURPOSE_UPLOAD_RULES[item.purpose].maxFilesPerBatch,
      ),
    );

    if (items.length > maxFiles) {
      this.reject(
        'input',
        maxFiles === 1
          ? 'Only one file is allowed in this batch'
          : `Maximum ${maxFiles} files are allowed`,
      );
    }

    items.forEach((item, index) => this.validateItem(item, index));
  }

  private validateItem(item: InitiateUploadInput, index: number): void {
    const rules = PURPOSE_UPLOAD_RULES[item.purpose];

    if (!rules.allowedMimeTypes.includes(item.mimeType)) {
      this.reject(`input.${index}.mimeType`, rules.errorMessage);
    }

    if (item.size > rules.maxSizeBytes) {
      this.reject(`input.${index}.size`, rules.errorMessage);
    }
  }

  private reject(field: string, message: string): never {
    const errors: ValidationErrorItem[] = [{ field, message }];
    throw new BadRequestException({ message, errors });
  }
}
