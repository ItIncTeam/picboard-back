/*import { Injectable, BadRequestException } from '@nestjs/common';
import { InitiateUploadInput } from '../../graphql/inputs/initiate-upload.input';
import { Purpose } from '../../domain/enums/file-purpose.enum';

@Injectable()
export class FileUploadPolicyService {
  validateBatch(items: InitiateUploadInput[]): void {
    if (!items.length) {
      throw new BadRequestException('At least one file is required');
    }

    if (items.length > 10) {
      throw new BadRequestException('Maximum 10 files are allowed');
    }
  }

  validateItem(item: InitiateUploadInput): void {
    switch (item.purpose) {
      case Purpose.POST:
        this.validatePostImage(item);
        return;
      case Purpose.BILL:
        this.validateBill(item);
        return;
      default:
        throw new BadRequestException('Unsupported file purpose');
    }
  }

  private validatePostImage(item: InitiateUploadInput): void {
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    const maxSize = 20 * 1024 * 1024;

    if (!allowedMimeTypes.includes(item.mimeType)) {
      throw new BadRequestException('POST files must be JPEG or PNG');
    }

    if (item.size > maxSize) {
      throw new BadRequestException(
        'POST file size must be less than or equal to 20 MB',
      );
    }
  }

  private validateBill(item: InitiateUploadInput): void {
    const allowedMimeTypes = ['application/pdf'];
    const maxSize = 20 * 1024 * 1024;

    if (!allowedMimeTypes.includes(item.mimeType)) {
      throw new BadRequestException('BILL files must be PDF');
    }

    if (item.size > maxSize) {
      throw new BadRequestException(
        'BILL file size must be less than or equal to 20 MB',
      );
    }
  }
}*/
