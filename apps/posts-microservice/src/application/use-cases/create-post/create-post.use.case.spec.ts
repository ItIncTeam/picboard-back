import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreatePostCommand, CreatePostUseCase } from './create-post.use.case';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { FilesServiceClient } from '../../../infrastructure/client/files-service.client';
import { PostEntity } from '../../../posts/entities/post.entity';
import { CreatePostInput } from '../../../posts/graphql/dto/create-post.input';

describe('CreatePostUseCase', () => {
  let useCase: CreatePostUseCase;
  let postsRepository: jest.Mocked<PostsRepository>;
  let filesClient: jest.Mocked<FilesServiceClient>;

  beforeEach(async () => {
    postsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByOwnerId: jest.fn(),
      findFeed: jest.fn(),
      findProfilePosts: jest.fn(),
      updateDescription: jest.fn(),
      softDelete: jest.fn(),
    };

    filesClient = {
      assertAllOwnedReadyOrException: jest.fn(),
      markFilesDeleted: jest.fn(),
    } as unknown as jest.Mocked<FilesServiceClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePostUseCase,
        { provide: PostsRepository, useValue: postsRepository },
        { provide: FilesServiceClient, useValue: filesClient },
      ],
    }).compile();

    useCase = module.get(CreatePostUseCase);
  });

  describe('successful creation', () => {
    it('should create post with valid file IDs and description', async () => {
      const input = new CreatePostInput();
      input.fileIds = ['file-1', 'file-2'];
      input.description = 'My post description';

      const expectedPost = { id: 'post-1' } as PostEntity;
      postsRepository.create.mockResolvedValue(expectedPost);

      const command = new CreatePostCommand(input, 'user-1');
      const result = await useCase.execute(command);

      expect(result).toBe(expectedPost);
      expect(filesClient.assertAllOwnedReadyOrException).toHaveBeenCalledWith(
        ['file-1', 'file-2'],
        'user-1',
      );
      expect(postsRepository.create).toHaveBeenCalledWith({
        ownerId: 'user-1',
        description: 'My post description',
        fileIds: ['file-1', 'file-2'],
      });
    });

    it('should create post without description', async () => {
      const input = new CreatePostInput();
      input.fileIds = ['file-1'];

      postsRepository.create.mockResolvedValue({ id: 'post-1' } as PostEntity);

      const command = new CreatePostCommand(input, 'user-1');
      await useCase.execute(command);

      expect(postsRepository.create).toHaveBeenCalledWith({
        ownerId: 'user-1',
        description: null,
        fileIds: ['file-1'],
      });
    });
  });

  describe('file count validation', () => {
    it('should throw BadRequestException when more than 10 files', async () => {
      const input = new CreatePostInput();
      input.fileIds = Array.from({ length: 11 }, (_, i) => `file-${i}`);

      const command = new CreatePostCommand(input, 'user-1');
      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      expect(filesClient.assertAllOwnedReadyOrException).not.toHaveBeenCalled();
      expect(postsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('file validation failure', () => {
    it('should throw BadRequestException when file IDs are invalid', async () => {
      const input = new CreatePostInput();
      input.fileIds = ['file-not-owned'];
      input.description = 'Test';

      filesClient.assertAllOwnedReadyOrException.mockRejectedValue(
        new BadRequestException('Invalid file ids: file-not-owned'),
      );

      const command = new CreatePostCommand(input, 'user-1');
      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      expect(postsRepository.create).not.toHaveBeenCalled();
    });
  });
});
