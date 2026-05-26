import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { default as request } from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthModule } from '@app/auth';
import { UsersPrismaService } from '../src/infrastructure/prisma/users-prisma.service';
import { EmailAdapter } from '../src/infrastructure/messaging/email.adapter';

@Module({})
class MockAuthModule {}

class MockEmailAdapter {
  async sendEmail() {
    return { messageId: 'mock' };
  }
}

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

describe('Users subgraph (e2e)', () => {
  let app: INestApplication;
  let prisma: UsersPrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AuthModule)
      .useModule(MockAuthModule)
      .overrideProvider(EmailAdapter)
      .useClass(MockEmailAdapter)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(UsersPrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should expose graphql endpoint', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'query { __typename }' })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data).toBeDefined();
  });

  it('should sign up a user', async () => {
    const email = uniqueEmail();
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
              message
            }
          }
        `,
        variables: {
          input: {
            email,
            username: `u_${Date.now()}`,
            password: 'password123',
          },
        },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.signUp.user.email).toBe(email);
    expect(res.body.data.signUp.user.id).toBeDefined();
    expect(res.body.data.signUp.user.isConfirmed).toBe(false);
    expect(res.body.data.signUp.message).toBe('Confirmation email sent');
  });

  it('should reject sign in for unconfirmed user', async () => {
    const email = uniqueEmail();

    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) { user { id } }
          }
        `,
        variables: {
          input: { email, username: `u_${Date.now()}`, password: 'pw' },
        },
      });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignIn($input: SignInInput!) {
            signIn(input: $input) { accessToken }
          }
        `,
        variables: { input: { email, password: 'pw' } },
      })
      .expect(200);

    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].message).toContain('Email is not confirmed');
  });

  it('should reject sign in with wrong password', async () => {
    const email = uniqueEmail();
    const username = `u_${Date.now()}`;

    const signUpRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
        variables: { input: { email, username, password: 'correct' } },
      });

    const userId = signUpRes.body.data.signUp.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignIn($input: SignInInput!) {
            signIn(input: $input) { accessToken }
          }
        `,
        variables: { input: { email, password: 'wrong' } },
      })
      .expect(200);

    expect(res.body.data).toBeNull();
    expect(res.body.errors[0].message).toContain('Invalid credentials');
  });

  it('should sign in a confirmed user', async () => {
    const email = uniqueEmail();
    const username = `u_${Date.now()}`;

    const signUpRes = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
        variables: { input: { email, username, password: 'password123' } },
      });

    const userId = signUpRes.body.data.signUp.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation SignIn($input: SignInInput!) {
            signIn(input: $input) {
              accessToken
              refreshToken
              user { id email username }
            }
          }
        `,
        variables: { input: { email, password: 'password123' } },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.signIn.accessToken).toBeDefined();
    expect(res.body.data.signIn.refreshToken).toBeDefined();
    expect(res.body.data.signIn.user.email).toBe(email);
    expect(res.body.data.signIn.user.username).toBe(username);
  });
});
