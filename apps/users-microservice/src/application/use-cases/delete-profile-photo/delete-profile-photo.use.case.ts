import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';

export class DeleteProfilePhotoCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(DeleteProfilePhotoCommand)
@Injectable()
export class DeleteProfilePhotoUseCase implements ICommandHandler<DeleteProfilePhotoCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  // Always true: with no avatar there's nothing to do, so a retried request
  // (the first one already cleared it) isn't an error
  async execute(command: DeleteProfilePhotoCommand): Promise<boolean> {
    await this.usersRepository.clearProfilePictureAndEnqueueFileDeletion(
      command.userId,
    );
    return true;
  }
}
