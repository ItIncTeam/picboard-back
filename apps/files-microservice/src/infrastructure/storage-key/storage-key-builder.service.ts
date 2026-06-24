import { BadRequestException, Injectable } from '@nestjs/common';
import { Purpose } from '../../domain/enums/file-purpose.enum';

@Injectable()
export class StorageKeyBuilder {
  build(params: {
    fileId: string;
    ownerId: string;
    originalName: string;
    purpose: Purpose;
  }): string {
    const extension = this.extractExtension(params.originalName);
    const purpose = this.extractPurpose(params.purpose);
    const yearMonth = this.getYearMonthPath();

    return `${purpose}/${params.ownerId}/${yearMonth}/${params.fileId}${extension}`;
  }

  private extractExtension(originalName: string): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    if (lastDotIndex === -1) return '';

    const ext = originalName.slice(lastDotIndex).toLowerCase();
    // Only allow alphanumeric + dot
    if (!/^[.][a-z0-9]+$/.test(ext)) return '';

    return ext;
  }

  private extractPurpose(purpose: Purpose): string {
    const safe = purpose.toLowerCase();
    if (!/^[a-z0-9-_]+$/.test(safe)) {
      throw new BadRequestException('Invalid purpose');
    }
    return safe;
  }

  private getYearMonthPath(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return `${year}/${month}`;
  }
}
