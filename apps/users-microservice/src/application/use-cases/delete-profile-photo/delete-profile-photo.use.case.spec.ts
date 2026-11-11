import { Test, TestingModule } from '@nestjs/testing';
import {
  DeleteProfilePhotoCommand,
  DeleteProfilePhotoUseCase,
} from './delete-profile-photo.use.case';
import { UsersRepository } from '../../../domain/repositories/users.repository';

const USER_ID = 'user-1';

describe('DeleteProfilePhotoUseCase', () => {
  let useCase: DeleteProfilePhotoUseCase;
  let usersRepository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    usersRepository = {
      clearProfilePictureAndEnqueueFileDeletion: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteProfilePhotoUseCase,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    useCase = module.get(DeleteProfilePhotoUseCase);
  });

  it("should clear the caller's avatar and return true", async () => {
    usersRepository.clearProfilePictureAndEnqueueFileDeletion.mockResolvedValue(
      undefined,
    );

    const result = await useCase.execute(
      new DeleteProfilePhotoCommand(USER_ID),
    );

    expect(result).toBe(true);
    expect(
      usersRepository.clearProfilePictureAndEnqueueFileDeletion,
    ).toHaveBeenCalledTimes(1);
    expect(
      usersRepository.clearProfilePictureAndEnqueueFileDeletion,
    ).toHaveBeenCalledWith(USER_ID);
  });

  it('should propagate a repository error instead of returning true', async () => {
    const error = new Error('Database unavailable');
    usersRepository.clearProfilePictureAndEnqueueFileDeletion.mockRejectedValue(
      error,
    );

    await expect(
      useCase.execute(new DeleteProfilePhotoCommand(USER_ID)),
    ).rejects.toBe(error);
  });
});
