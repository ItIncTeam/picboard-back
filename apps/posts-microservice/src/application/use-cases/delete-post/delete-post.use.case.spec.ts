import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { FilesServiceClient } from '../../../infrastructure/client/files-service.client';
import { PostEntity } from '../../../posts/entities/post.entity';
import { PostAttachmentEntity } from '../../../posts/entities/post-attachment.entity';

function createPostAttachment(
  overrides: Partial<PostAttachmentEntity> = {},
): PostAttachmentEntity {
  return {
    fileId: 'file-1',
    sortOrder: 0,
    file: { id: 'file-1', url: 'https://example.com/file' },
    ...overrides,
  } as PostAttachmentEntity;
}

function createPost(overrides: Partial<PostEntity> = {}): PostEntity {
  return {
    id: 'post-1',
    ownerId: 'user-1',
    description: 'Test post',
    attachments: [createPostAttachment()],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('DeletePostUseCase', () => {
  let useCase: DeletePostUseCase;
  let postsRepository: jest.Mocked<PostsRepository>;
  let filesClient: jest.Mocked<FilesServiceClient>;

  beforeEach(async () => {
    postsRepository = {
      findById: jest.fn(),
      softDelete: jest.fn(),
      create: jest.fn(),
      findByIds: jest.fn(),
      findByOwnerId: jest.fn(),
      findFeed: jest.fn(),
      findProfilePosts: jest.fn(),
      updateDescription: jest.fn(),
    };

    filesClient = {
      markFilesDeleted: jest.fn(),
      assertAllOwnedReadyOrException: jest.fn(),
    } as unknown as jest.Mocked<FilesServiceClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletePostUseCase,
        { provide: PostsRepository, useValue: postsRepository },
        { provide: FilesServiceClient, useValue: filesClient },
      ],
    }).compile();

    useCase = module.get(DeletePostUseCase);
  });

  describe('successful deletion', () => {
    it('should soft delete post and mark files as deleted', async () => {
      const post = createPost({
        attachments: [createPostAttachment({ fileId: 'file-1' })],
      });
      postsRepository.findById.mockResolvedValue(post);
      postsRepository.softDelete.mockResolvedValue(undefined);

      const command = new DeletePostCommand('post-1', 'user-1');
      await useCase.execute(command);

      expect(postsRepository.softDelete).toHaveBeenCalledWith('post-1');
      expect(filesClient.markFilesDeleted).toHaveBeenCalledWith({
        fileIds: ['file-1'],
        ownerId: 'user-1',
      });
    });

    it('should handle post with multiple attachments', async () => {
      const post = createPost({
        attachments: [
          createPostAttachment({ fileId: 'file-1' }),
          createPostAttachment({ fileId: 'file-2', sortOrder: 1 }),
        ],
      });
      postsRepository.findById.mockResolvedValue(post);

      const command = new DeletePostCommand('post-1', 'user-1');
      await useCase.execute(command);

      expect(filesClient.markFilesDeleted).toHaveBeenCalledWith({
        fileIds: ['file-1', 'file-2'],
        ownerId: 'user-1',
      });
    });
  });

  describe('post not found', () => {
    it('should throw NotFoundException', async () => {
      postsRepository.findById.mockResolvedValue(null);

      const command = new DeletePostCommand('non-existent', 'user-1');
      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(command)).rejects.toThrow('Post not found');

      expect(postsRepository.softDelete).not.toHaveBeenCalled();
      expect(filesClient.markFilesDeleted).not.toHaveBeenCalled();
    });
  });

  describe('not the owner', () => {
    it('should throw ForbiddenException when another user tries to delete', async () => {
      const post = createPost({ ownerId: 'user-1' });
      postsRepository.findById.mockResolvedValue(post);

      const command = new DeletePostCommand('post-1', 'user-2');
      await expect(useCase.execute(command)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(useCase.execute(command)).rejects.toThrow('Access denied');

      expect(postsRepository.softDelete).not.toHaveBeenCalled();
      expect(filesClient.markFilesDeleted).not.toHaveBeenCalled();
    });
  });
});
