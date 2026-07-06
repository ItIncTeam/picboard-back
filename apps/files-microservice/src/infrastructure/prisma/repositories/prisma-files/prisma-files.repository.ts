import { Injectable } from '@nestjs/common';
import { FilesRepository } from '../../../../domain/repositories/files/files.repository';
import { FileEntity } from '../../../../domain/entities/file.entity';
import { FilesPrismaService } from '../../files-prisma.service';
import { CreatePendingFileData } from '../../../../domain/repositories/files/create-pending-file-data.type';
import { FileStatus } from '../../../../domain/enums/file-status.enum';
import { Mime } from '../../../../domain/enums/file-mime';
import { Purpose } from '../../../../domain/enums/file-purpose.enum';

@Injectable()
export class PrismaFilesRepository implements FilesRepository {
  constructor(private readonly prisma: FilesPrismaService) {}

  async createManyPending(
    items: CreatePendingFileData[],
  ): Promise<FileEntity[]> {
    if (items.length === 0) {
      return [];
    }

    const created = await Promise.all(
      items.map((item) =>
        this.prisma.file.create({
          data: item,
          select: {
            id: true,
            ownerId: true,
            originalName: true,
            purpose: true,
            mimeType: true,
            size: true,
            status: true,
            createdAt: true,
            storageKey: true,
            bucket: true,
          },
        }),
      ),
    );

    return created.map(
      (file) =>
        new FileEntity(
          file.id,
          file.ownerId,
          file.originalName,
          file.purpose as Purpose,
          file.mimeType as Mime,
          file.size,
          file.status as FileStatus,
          file.createdAt,
          file.storageKey,
          file.bucket,
        ),
    );
  }

  async findByIdsOwnerAndStatus(
    ids: string[],
    ownerId: string,
    status: FileStatus,
  ): Promise<FileEntity[]> {
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: ids },
        ownerId,
        status,
      },
    });

    return files.map((file) => this.toEntity(file));
  }

  async updateStatus(
    id: string,
    status: FileStatus,
    failedReason?: string | null,
    timestamp?: Date | null,
  ): Promise<FileEntity> {
    const updateData: {
      status: FileStatus;
      failedReason?: string | null;
      updatedAt: Date;
      readyAt?: Date | null;
      failedAt?: Date | null;
    } = {
      status,
      updatedAt: new Date(),
    };

    // Set failedReason if provided
    if (failedReason !== undefined) {
      updateData.failedReason = failedReason;
    }

    // Set timestamp-specific fields based on status
    if (timestamp) {
      if (status === FileStatus.READY) {
        updateData.readyAt = timestamp;
      } else if (status === FileStatus.FAILED) {
        updateData.failedAt = timestamp;
      }
    } else if (status === FileStatus.FAILED) {
      // If no timestamp provided but status is FAILED, set failedAt to now
      updateData.failedAt = new Date();
    }

    const file = await this.prisma.file.update({
      where: { id },
      data: updateData,
    });

    return this.toEntity(file);
  }

  async findById(id: string): Promise<FileEntity> {
    const file = await this.prisma.file.findUnique({
      where: {
        id,
      },
    });

    return this.toEntity(file);
  }

  async findByIds(ids: string[]): Promise<FileEntity[]> {
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: ids },
      },
    });
    return files.map((file) => this.toEntity(file));
  }

  private toEntity(file: any): FileEntity {
    return {
      id: file.id,
      ownerId: file.ownerId,
      originalName: file.originalName,
      purpose: file.purpose,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      createdAt: file.createdAt,
      storageKey: file.storageKey,
      bucket: file.bucket,
    };
  }
}
