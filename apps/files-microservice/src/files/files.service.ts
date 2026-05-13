import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { FilesPrismaService } from '../prisma/files-prisma.service';
import { CreateUploadSessionInput } from './dto/create-upload-session.input';
import { RMQ_SERVICE } from '@app/rmq';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: FilesPrismaService,
    @Inject(RMQ_SERVICE) private readonly rmqClient: ClientProxy,
  ) {
    console.log('files.service token', RMQ_SERVICE);
  }

  findById(id: string) {
    return this.prisma.fileAsset.findUnique({
      where: { id },
    });
  }

  async createUploadSession(input: CreateUploadSessionInput) {
    const objectKey = `${input.ownerId}/${randomUUID()}`;

    return this.prisma.fileAsset.create({
      data: {
        ownerId: input.ownerId,
        purpose: input.purpose,
        mimeType: input.mimeType,
        size: input.size,
        bucket: process.env.MINIO_BUCKET || 'uploads',
        objectKey,
        status: 'PENDING',
      },
    });
  }

  async confirmUpload(id: string, url: string) {
    const file = await this.prisma.fileAsset.update({
      where: { id },
      data: {
        status: 'READY',
        url,
      },
    });

    this.rmqClient.emit('file.upload.completed', {
      fileId: file.id,
      ownerId: file.ownerId,
      purpose: file.purpose,
      url: file.url,
    });

    return file;
  }
}
