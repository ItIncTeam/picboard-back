import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { default as request } from 'supertest';
import { AppModule } from '../src/app.module';
import { FilesServiceClient } from '../src/infrastructure/client/files-service.client';

class MockFilesServiceClient {
  async assertAllOwnedReadyOrException(
    _fileIds: string[],
    _ownerId: string,
  ): Promise<void> {
    // success — no TCP call
  }

  async markFilesDeleted(_data: {
    fileIds: string[];
    ownerId: string;
  }): Promise<void> {
    // noop
  }
}

const rootUrl = '/api/v1';
const subgraphSecret = 'posts-secret';

describe('Posts subgraph (e2e)', () => {
  let app: INestApplication;

  const authPost = (userId = 'user-1') =>
    request(app.getHttpServer())
      .post(rootUrl)
      .set('x-user-id', userId)
      .set('x-user-role', 'user')
      .set('Router-Authorization', subgraphSecret);

  const publicPost = () =>
    request(app.getHttpServer())
      .post(rootUrl)
      .set('Router-Authorization', subgraphSecret);

  beforeAll(async () => {
    process.env.POSTS_SUBGRAPH_SECRET = subgraphSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FilesServiceClient)
      .useClass(MockFilesServiceClient)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('feed (public)', () => {
    it('should return posts list without x-user-id', async () => {
      const res = await publicPost()
        .send({ query: '{ feed { id } }' })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.feed).toBeInstanceOf(Array);
    });
  });

  describe('createPost', () => {
    it('should create a post with file IDs', async () => {
      const res = await authPost()
        .send({
          query: `
            mutation CreatePost($input: CreatePostInput!) {
              createPost(input: $input) {
                id description attachments { fileId }
              }
            }
          `,
          variables: {
            input: {
              fileIds: ['00000000-0000-0000-0000-000000000001'],
              description: 'E2E test post',
            },
          },
        })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.createPost.id).toBeDefined();
      expect(res.body.data.createPost.description).toBe('E2E test post');

      // save for later tests
      this.createdPostId = res.body.data.createPost.id;
    });

    it('should reject > 10 files', async () => {
      const res = await authPost()
        .send({
          query: `
            mutation CreatePost($input: CreatePostInput!) {
              createPost(input: $input) { id }
            }
          `,
          variables: {
            input: {
              fileIds: Array.from(
                { length: 11 },
                (_, i) =>
                  `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
              ),
            },
          },
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('Maximum 10 files per post');
    });

    it('should accept exactly 10 files', async () => {
      const res = await authPost()
        .send({
          query: `
            mutation CreatePost($input: CreatePostInput!) {
              createPost(input: $input) { id attachments { fileId } }
            }
          `,
          variables: {
            input: {
              fileIds: Array.from(
                { length: 10 },
                (_, i) =>
                  `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
              ),
            },
          },
        })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.createPost.id).toBeDefined();
      expect(res.body.data.createPost.attachments).toHaveLength(10);
    });

    it('should reject without x-user-id', async () => {
      const res = await publicPost()
        .send({
          query: `
            mutation {
              createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
            }
          `,
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('editPost', () => {
    it('should edit own post description', async () => {
      if (!this.createdPostId) {
        // create a post first
        const createRes = await authPost()
          .send({
            query: `
              mutation {
                createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
              }
            `,
          })
          .expect(200);
        this.createdPostId = createRes.body.data.createPost.id;
      }

      const res = await authPost()
        .send({
          query: `
            mutation UpdateDescription($input: UpdatePostDescriptionInput!) {
              updatePostDescription(input: $input) { id description }
            }
          `,
          variables: {
            input: {
              postId: this.createdPostId,
              description: 'Updated description',
            },
          },
        })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.updatePostDescription.description).toBe(
        'Updated description',
      );
    });

    it('should reject editing non-existing post', async () => {
      const res = await authPost()
        .send({
          query: `
            mutation {
              updatePostDescription(input: { postId: "non-existent-id" }) { id }
            }
          `,
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('Post not found');
    });

    it('should reject editing another user post', async () => {
      if (!this.createdPostId) {
        const createRes = await authPost()
          .send({
            query: `
              mutation {
                createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
              }
            `,
          })
          .expect(200);
        this.createdPostId = createRes.body.data.createPost.id;
      }

      const res = await authPost('user-2')
        .send({
          query: `
            mutation UpdateDescription($input: UpdatePostDescriptionInput!) {
              updatePostDescription(input: $input) { id }
            }
          `,
          variables: {
            input: {
              postId: this.createdPostId,
              description: 'Hacked description',
            },
          },
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('Access denied');
    });
  });

  describe('deletePost', () => {
    it('should delete own post', async () => {
      const createRes = await authPost()
        .send({
          query: `
            mutation {
              createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
            }
          `,
        })
        .expect(200);

      const postId = createRes.body.data.createPost.id;

      const res = await authPost()
        .send({
          query: `
            mutation DeletePost($input: DeletePostInput!) {
              deletePost(input: $input)
            }
          `,
          variables: { input: { postId } },
        })
        .expect(200);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.deletePost).toBe(true);
    });

    it('should reject deleting another user post', async () => {
      const createRes = await authPost('user-1')
        .send({
          query: `
            mutation {
              createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
            }
          `,
        })
        .expect(200);

      const postId = createRes.body.data.createPost.id;

      const res = await authPost('user-2')
        .send({
          query: `
            mutation DeletePost($input: DeletePostInput!) {
              deletePost(input: $input)
            }
          `,
          variables: { input: { postId } },
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('Access denied');
    });

    it('should reject deleting non-existing post', async () => {
      const res = await authPost()
        .send({
          query: `
            mutation {
              deletePost(input: { postId: "non-existent-id" })
            }
          `,
        })
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('Post not found');
    });
  });

  describe('deleted post visibility', () => {
    it('should not return deleted post in feed', async () => {
      const createRes = await authPost()
        .send({
          query: `
            mutation {
              createPost(input: { fileIds: ["00000000-0000-0000-0000-000000000001"] }) { id }
            }
          `,
        })
        .expect(200);

      const postId = createRes.body.data.createPost.id;

      await authPost()
        .send({
          query: `
            mutation DeletePost($input: DeletePostInput!) {
              deletePost(input: $input)
            }
          `,
          variables: { input: { postId } },
        })
        .expect(200);

      const feedRes = await publicPost()
        .send({ query: '{ feed { id } }' })
        .expect(200);

      const ids = feedRes.body.data.feed.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(postId);
    });
  });
});
