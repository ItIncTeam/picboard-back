import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  UpdatePostDescriptionCommand,
  UpdatePostDescriptionUseCase,
} from './update-post-description.use.case';
import { PostsRepository } from '../../../domain/repositories/posts.repository';
import { PostEntity } from '../../../posts/entities/post.entity';
import { UpdatePostDescriptionInput } from '../../../posts/graphql/dto/update-post-description.input';

function createPost(overrides: Partial<PostEntity> = {}): PostEntity {
  return {
    id: 'post-1',
    ownerId: 'user-1',
    description: 'Original description',
    attachments: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('UpdatePostDescriptionUseCase', () => {
  let useCase: UpdatePostDescriptionUseCase;
  let postsRepository: jest.Mocked<PostsRepository>;

  beforeEach(async () => {
    postsRepository = {
      findById: jest.fn(),
      updateDescription: jest.fn(),
      create: jest.fn(),
      findByIds: jest.fn(),
      findByOwnerId: jest.fn(),
      findFeed: jest.fn(),
      findProfilePosts: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePostDescriptionUseCase,
        { provide: PostsRepository, useValue: postsRepository },
      ],
    }).compile();

    useCase = module.get(UpdatePostDescriptionUseCase);
  });

  describe('successful update', () => {
    it('should update description of own post', async () => {
      const post = createPost();
      postsRepository.findById.mockResolvedValue(post);
      postsRepository.updateDescription.mockResolvedValue({
        ...post,
        description: 'Updated description',
      });

      const input = new UpdatePostDescriptionInput();
      input.postId = 'post-1';
      input.description = 'Updated description';

      const command = new UpdatePostDescriptionCommand(input, 'user-1');
      const result = await useCase.execute(command);

      expect(result.description).toBe('Updated description');
      expect(postsRepository.updateDescription).toHaveBeenCalledWith(
        'post-1',
        'Updated description',
      );
    });

    it('should allow clearing description (set to null)', async () => {
      const post = createPost();
      postsRepository.findById.mockResolvedValue(post);
      postsRepository.updateDescription.mockResolvedValue(post);

      const input = new UpdatePostDescriptionInput();
      input.postId = 'post-1';
      input.description = undefined;

      const command = new UpdatePostDescriptionCommand(input, 'user-1');
      await useCase.execute(command);

      expect(postsRepository.updateDescription).toHaveBeenCalledWith(
        'post-1',
        null,
      );
    });
  });

  describe('post not found', () => {
    it('should throw NotFoundException', async () => {
      postsRepository.findById.mockResolvedValue(null);

      const input = new UpdatePostDescriptionInput();
      input.postId = 'non-existent';

      const command = new UpdatePostDescriptionCommand(input, 'user-1');
      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(command)).rejects.toThrow('Post not found');

      expect(postsRepository.updateDescription).not.toHaveBeenCalled();
    });
  });

  describe('not the owner', () => {
    it('should throw ForbiddenException when another user tries to edit', async () => {
      const post = createPost({ ownerId: 'user-1' });
      postsRepository.findById.mockResolvedValue(post);

      const input = new UpdatePostDescriptionInput();
      input.postId = 'post-1';
      input.description = 'Hacked description';

      const command = new UpdatePostDescriptionCommand(input, 'user-2');
      await expect(useCase.execute(command)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(useCase.execute(command)).rejects.toThrow('Access denied');

      expect(postsRepository.updateDescription).not.toHaveBeenCalled();
    });
  });
});
