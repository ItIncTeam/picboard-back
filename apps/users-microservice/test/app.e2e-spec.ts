import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { default as request } from 'supertest';
import cookieParser from 'cookie-parser';
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
const rootUrl = '/api/v1';

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
    app.use(cookieParser());
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
      .post(rootUrl)
      .send({ query: 'query { __typename }' })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data).toBeDefined();
  });

  it('should sign up a user', async () => {
    const email = uniqueEmail();
    const res = await request(app.getHttpServer())
      .post(rootUrl)
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
      .post(rootUrl)
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
      .post(rootUrl)
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
      .post(rootUrl)
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
      .post(rootUrl)
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
      .post(rootUrl)
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
      .post(rootUrl)
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

  it('should logout a user and clear refresh token cookie', async () => {
    const email = uniqueEmail();
    const username = `u_${Date.now()}`;

    // Sign up
    const signUpRes = await request(app.getHttpServer())
      .post(rootUrl)
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
        variables: { input: { email, username, password: 'password123' } },
      })
      .expect(200);

    const userId = signUpRes.body.data.signUp.user.id;

    // Confirm user
    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    // Sign in to get refreshToken cookie
    const signInRes = await request(app.getHttpServer())
      .post(rootUrl)
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

    expect(signInRes.body.errors).toBeUndefined();
    expect(signInRes.body.data.signIn.refreshToken).toBeDefined();

    const cookies = signInRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Logout with the refreshToken cookie
    const logoutRes = await request(app.getHttpServer())
      .post(rootUrl)
      .set('Cookie', cookies)
      .send({ query: 'mutation { logout }' })
      .expect(200);

    expect(logoutRes.body.errors).toBeUndefined();
    expect(logoutRes.body.data.logout).toBe('Logged out');

    // Should clear the refreshToken cookie
    const clearCookieHeader = logoutRes.headers['set-cookie'];
    expect(clearCookieHeader).toBeDefined();
    const clearCookieStr = Array.isArray(clearCookieHeader)
      ? clearCookieHeader.join('; ')
      : clearCookieHeader;
    expect(clearCookieStr).toContain('refreshToken');
  });

  describe('refreshToken mutation', () => {
    jest.setTimeout(15_000);

    const signUpAndConfirm = async () => {
      const email = uniqueEmail();
      const username = `u_${Date.now()}`;

      const signUpRes = await request(app.getHttpServer())
        .post(rootUrl)
        .send({
          query: `
            mutation SignUp($input: SignUpInput!) {
              signUp(input: $input) {
                user { id email username }
              }
            }
          `,
          variables: { input: { email, username, password: 'password123' } },
        })
        .expect(200);

      const userId = signUpRes.body.data.signUp.user.id;

      await prisma.user.update({
        where: { id: userId },
        data: { isConfirmed: true },
      });

      return { email, username, userId };
    };

    it('should refresh tokens and set new cookie', async () => {
      const { email, username } = await signUpAndConfirm();

      // Sign in to get refreshToken
      const signInRes = await request(app.getHttpServer())
        .post(rootUrl)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                refreshToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const refreshTokenValue = signInRes.body.data.signIn.refreshToken;

      // Refresh tokens with manual Cookie header (body value, not raw Set-Cookie)
      const refreshRes = await request(app.getHttpServer())
        .post(rootUrl)
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({
          query: 'mutation { refreshToken { accessToken refreshToken } }',
        })
        .expect(200);

      expect(refreshRes.body.errors).toBeUndefined();
      expect(refreshRes.body.data.refreshToken.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken.refreshToken).toBeDefined();

      // Should set a new refreshToken cookie
      const newCookies = refreshRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newCookieStr = Array.isArray(newCookies)
        ? newCookies.join('; ')
        : newCookies;
      expect(newCookieStr).toContain('refreshToken');
    });

    it('should reject refresh token without cookie', async () => {
      const res = await request(app.getHttpServer())
        .post(rootUrl)
        .send({
          query: 'mutation { refreshToken { accessToken refreshToken } }',
        })
        .expect(200);

      expect(res.body.data).toBeNull();
      expect(res.body.errors[0].message).toContain('No refresh token provided');
    });

    it('should reject reused refresh token after rotation', async () => {
      const { email } = await signUpAndConfirm();
      const agent = request.agent(app.getHttpServer());

      // Sign in — agent captures Set-Cookie automatically
      const signInRes = await agent
        .post(rootUrl)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                refreshToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const oldRefreshToken = signInRes.body.data.signIn.refreshToken;

      // Agent sends the captured refreshToken cookie — first refresh succeeds
      const firstRefresh = await agent
        .post(rootUrl)
        .send({
          query: 'mutation { refreshToken { accessToken refreshToken } }',
        })
        .expect(200);

      expect(firstRefresh.body.errors).toBeUndefined();
      expect(firstRefresh.body.data.refreshToken.refreshToken).not.toBe(
        oldRefreshToken,
      );

      // Agent now has the NEW cookie from Set-Cookie — second refresh also succeeds
      const secondRefresh = await agent
        .post(rootUrl)
        .send({
          query: 'mutation { refreshToken { accessToken refreshToken } }',
        })
        .expect(200);

      expect(secondRefresh.body.errors).toBeUndefined();

      // Old token is dead — raw request with the original token fails
      const oldAttempt = await request(app.getHttpServer())
        .post(rootUrl)
        .set('Cookie', `refreshToken=${oldRefreshToken}`)
        .send({
          query: 'mutation { refreshToken { accessToken refreshToken } }',
        })
        .expect(200);

      expect(oldAttempt.body.data).toBeNull();
      expect(oldAttempt.body.errors[0].message).toContain(
        'Refresh token has been revoked',
      );
    });

    it('should produce a valid JWT access token after refresh', async () => {
      const { email } = await signUpAndConfirm();

      // Sign in
      const signInRes = await request(app.getHttpServer())
        .post(rootUrl)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                refreshToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const refreshTokenValue = signInRes.body.data.signIn.refreshToken;

      // Refresh
      const refreshRes = await request(app.getHttpServer())
        .post(rootUrl)
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({ query: 'mutation { refreshToken { accessToken } }' })
        .expect(200);

      const newAccessToken = refreshRes.body.data.refreshToken.accessToken;

      // Decode the JWT to verify it contains the correct payload
      const payloadBase64 = newAccessToken.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString('utf-8'),
      );

      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email', email);
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      // Access token should expire in ~2 minutes
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(180);
    });
  });
});
