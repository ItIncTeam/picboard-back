import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FilesRepository } from '../../../domain/repositories/files/files.repository';
import { FileEntity } from '../../../domain/entities/file.entity';

export class GetFileByIdQuery {
  constructor(public readonly fileId: string) {}
}

@QueryHandler(GetFileByIdQuery)
@Injectable()
export class GetFileByIdQueryHandler implements IQueryHandler<
  GetFileByIdQuery,
  FileEntity
> {
  constructor(private readonly filesRepository: FilesRepository) {}

  async execute(query: GetFileByIdQuery): Promise<FileEntity> {
    const file = await this.filesRepository.findById(query.fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }
}
