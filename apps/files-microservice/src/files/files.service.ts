import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { FilesPrismaService } from '../prisma/files-prisma.service';
import { CreateUploadSessionInput } from './dto/create-upload-session.input';
import { FILES_RMQ_CLIENT } from './files.constants';
import { AppConfig } from '../config/app.config';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: FilesPrismaService,
    private readonly appConfig: AppConfig,
    // @Inject(FILES_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

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
        bucket: this.appConfig.minioBucket,
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

    /*this.client.emit('file.upload.completed', {
      fileId: file.id,
      ownerId: file.ownerId,
      purpose: file.purpose,
      url: file.url,
    });*/

    return file;
  }
}
