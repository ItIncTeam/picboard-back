import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { FilesService } from '../../../domain/services/files.service';

export class SetProfilePhotoCommand {
  constructor(
    public readonly userId: string,
    public readonly fileId: string,
  ) {}
}

@CommandHandler(SetProfilePhotoCommand)
@Injectable()
export class SetProfilePhotoUseCase implements ICommandHandler<SetProfilePhotoCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly filesService: FilesService,
  ) {}

  async execute(command: SetProfilePhotoCommand): Promise<UserEntity> {
    const { userId, fileId } = command;

    // false covers all three rejections: someone else's file, not READY, not an AVATAR
    const isValid = await this.filesService.isOwnedReadyAvatar(fileId, userId);
    if (!isValid) {
      throw new BadRequestException(`Invalid file id: ${fileId}`);
    }

    return this.usersRepository.setProfilePictureAndEnqueueOldFileDeletion(
      userId,
      fileId,
    );
  }
}
