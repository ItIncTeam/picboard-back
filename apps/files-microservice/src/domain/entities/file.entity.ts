import { FileStatus } from '../enums/file-status.enum';
import { Purpose } from '../enums/file-purpose.enum';
import { Mime } from '../enums/file-mime';

export class FileEntity {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public readonly originalName: string,
    public readonly purpose: Purpose,
    public readonly mimeType: Mime,
    public readonly size: number,
    public readonly status: FileStatus,
    public readonly createdAt: Date,
    public readonly storageKey: string,
    public readonly bucket: string,
    public readonly url?: string,
    /*public readonly updatedAt: Date | null,
    public readonly checksum?: string | null,
    public readonly uploadedAt?: Date | null,
    public readonly readyAt?: Date | null,
    public readonly failedAt?: Date | null,
    public readonly deletedAt?: Date | null,
    public readonly failedReason?: string | null,*/
  ) {}
}
