import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  SetProfilePhotoCommand,
  SetProfilePhotoUseCase,
} from './set-profile-photo.use.case';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { FilesService } from '../../../domain/services/files.service';
import { UserEntity } from '../../../domain/entities/user.entity';

const USER_ID = 'user-1';
const FILE_ID = 'file-1';

function createUser(profilePictureFileId: string | null): UserEntity {
  return new UserEntity(
    USER_ID,
    'test@example.com',
    'testuser',
    '$2b$10$hashedpassword',
    new Date('2026-01-01'),
    null,
    null,
    true,
    null,
    null,
    profilePictureFileId,
  );
}

describe('SetProfilePhotoUseCase', () => {
  let useCase: SetProfilePhotoUseCase;
  let usersRepository: jest.Mocked<UsersRepository>;
  let filesService: jest.Mocked<FilesService>;

  beforeEach(async () => {
    usersRepository = {
      setProfilePictureAndEnqueueOldFileDeletion: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    filesService = {
      isOwnedReadyAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetProfilePhotoUseCase,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    useCase = module.get(SetProfilePhotoUseCase);
  });

  describe('valid avatar', () => {
    it('should set the avatar and return the updated user', async () => {
      const user = createUser(FILE_ID);
      filesService.isOwnedReadyAvatar.mockResolvedValue(true);
      usersRepository.setProfilePictureAndEnqueueOldFileDeletion.mockResolvedValue(
        user,
      );

      const result = await useCase.execute(
        new SetProfilePhotoCommand(USER_ID, FILE_ID),
      );

      expect(result).toBe(user);
      expect(filesService.isOwnedReadyAvatar).toHaveBeenCalledWith(
        FILE_ID,
        USER_ID,
      );
      expect(
        usersRepository.setProfilePictureAndEnqueueOldFileDeletion,
      ).toHaveBeenCalledWith(USER_ID, FILE_ID);
    });
  });

  describe('file rejected by files-service', () => {
    it('should throw BadRequestException and not change the avatar', async () => {
      filesService.isOwnedReadyAvatar.mockResolvedValue(false);

      const command = new SetProfilePhotoCommand(USER_ID, FILE_ID);

      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        `Invalid file id: ${FILE_ID}`,
      );

      expect(
        usersRepository.setProfilePictureAndEnqueueOldFileDeletion,
      ).not.toHaveBeenCalled();
    });
  });

  describe('files-service unavailable', () => {
    it('should propagate the error and not change the avatar', async () => {
      const error = new ServiceUnavailableException(
        'Files service unavailable',
      );
      filesService.isOwnedReadyAvatar.mockRejectedValue(error);

      await expect(
        useCase.execute(new SetProfilePhotoCommand(USER_ID, FILE_ID)),
      ).rejects.toBe(error);

      expect(
        usersRepository.setProfilePictureAndEnqueueOldFileDeletion,
      ).not.toHaveBeenCalled();
    });
  });
});
