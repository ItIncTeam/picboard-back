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

    /*// rejects names with no dot at all
    if (lastDotIndex === -1) return '';*/
    // also rejects names that start with a dot, like .env or .bashrc
    if (lastDotIndex <= 0) {
      return '';
    }

    const ext = originalName.slice(lastDotIndex).toLowerCase();

    // only allow alphanumeric + dot
    if (!/^\.[a-z0-9]+$/.test(ext)) {
      return '';
    }

    // rejects extensions longer than 16 characters
    if (ext.length > 16) {
      return '';
    }

    return ext;
  }

  private extractPurpose(purpose: Purpose): string {
    const safe = String(purpose).toLowerCase();
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
