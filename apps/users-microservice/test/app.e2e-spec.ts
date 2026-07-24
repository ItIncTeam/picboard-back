import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { default as request } from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AuthModule } from '@app/auth';
import { RecaptchaGuard } from '@app/common';
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
const subgraphSecret = 'users-secret';

/** Извлекает refresh token из Set-Cookie заголовка ответа */
const refreshTokenFromCookie = (res: request.Response): string => {
  const raw = res.headers['set-cookie'];
  const cookieStr = Array.isArray(raw) ? raw[0] : raw;
  return cookieStr.split(';')[0].split('=')[1];
};

describe('Users subgraph (e2e)', () => {
  let app: INestApplication;
  let prisma: UsersPrismaService;

  /** Хелпер — POST с Router-Authorization (имитирует gateway) */
  const authPost = (url: string) =>
    request(app.getHttpServer())
      .post(url)
      .set('Router-Authorization', subgraphSecret);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AuthModule)
      .useModule(MockAuthModule)
      .overrideProvider(EmailAdapter)
      .useClass(MockEmailAdapter)
      .overrideGuard(RecaptchaGuard)
      .useValue({ canActivate: () => true })
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
    const res = await authPost(rootUrl)
      .send({ query: 'query { __typename }' })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data).toBeDefined();
  });

  it('should sign up a user', async () => {
    const email = uniqueEmail();
    const res = await authPost(rootUrl)
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
            acceptTerms: true,
            acceptPrivacy: true,
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

    await authPost(rootUrl).send({
      query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) { user { id } }
          }
        `,
      variables: {
        input: {
          email,
          username: `u_${Date.now()}`,
          password: 'Password1',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      },
    });

    const res = await authPost(rootUrl)
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

    const signUpRes = await authPost(rootUrl).send({
      query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
      variables: {
        input: {
          email,
          username,
          password: 'correct',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      },
    });

    const userId = signUpRes.body.data.signUp.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    const res = await authPost(rootUrl)
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

    const signUpRes = await authPost(rootUrl).send({
      query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
      variables: {
        input: {
          email,
          username,
          password: 'password123',
          acceptTerms: true,
          acceptPrivacy: true,
        },
      },
    });

    const userId = signUpRes.body.data.signUp.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    const res = await authPost(rootUrl)
      .send({
        query: `
          mutation SignIn($input: SignInInput!) {
            signIn(input: $input) {
              accessToken
              user { id email username }
            }
          }
        `,
        variables: { input: { email, password: 'password123' } },
      })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.signIn.accessToken).toBeDefined();
    expect(res.body.data.signIn.user.email).toBe(email);
    expect(res.body.data.signIn.user.username).toBe(username);
  });

  it('should logout a user and clear refresh token cookie', async () => {
    const email = uniqueEmail();
    const username = `u_${Date.now()}`;

    // Sign up
    const signUpRes = await authPost(rootUrl)
      .send({
        query: `
          mutation SignUp($input: SignUpInput!) {
            signUp(input: $input) {
              user { id email username isConfirmed }
            }
          }
        `,
        variables: {
          input: {
            email,
            username,
            password: 'password123',
            acceptTerms: true,
            acceptPrivacy: true,
          },
        },
      })
      .expect(200);

    const userId = signUpRes.body.data.signUp.user.id;

    // Confirm user
    await prisma.user.update({
      where: { id: userId },
      data: { isConfirmed: true },
    });

    // Sign in to get refreshToken cookie
    const signInRes = await authPost(rootUrl)
      .send({
        query: `
          mutation SignIn($input: SignInInput!) {
            signIn(input: $input) {
              accessToken
              user { id email username }
            }
          }
        `,
        variables: { input: { email, password: 'password123' } },
      })
      .expect(200);

    expect(signInRes.body.errors).toBeUndefined();

    const cookies = signInRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // Logout with the refreshToken cookie
    const logoutRes = await authPost(rootUrl)
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

      const signUpRes = await authPost(rootUrl)
        .send({
          query: `
            mutation SignUp($input: SignUpInput!) {
              signUp(input: $input) {
                user { id email username }
              }
            }
          `,
          variables: {
            input: {
              email,
              username,
              password: 'password123',
              acceptTerms: true,
              acceptPrivacy: true,
            },
          },
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
      const { email } = await signUpAndConfirm();

      // Sign in to get refreshToken cookie
      const signInRes = await authPost(rootUrl)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const refreshTokenValue = refreshTokenFromCookie(signInRes);

      // Refresh with the token from cookie
      const refreshRes = await authPost(rootUrl)
        .set('Cookie', `refreshToken=${refreshTokenValue}`)
        .send({
          query: 'mutation { refreshToken { accessToken } }',
        })
        .expect(200);

      expect(refreshRes.body.errors).toBeUndefined();
      expect(refreshRes.body.data.refreshToken.accessToken).toBeDefined();

      // Should set a new refreshToken cookie
      const newCookies = refreshRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newCookieStr = Array.isArray(newCookies)
        ? newCookies.join('; ')
        : newCookies;
      expect(newCookieStr).toContain('refreshToken');
    });

    it('should reject refresh token without cookie', async () => {
      const res = await authPost(rootUrl)
        .send({
          query: 'mutation { refreshToken { accessToken } }',
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
        .set('Router-Authorization', subgraphSecret)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const oldRefreshToken = refreshTokenFromCookie(signInRes);

      // Agent sends the captured refreshToken cookie — first refresh succeeds
      const firstRefresh = await agent
        .post(rootUrl)
        .set('Router-Authorization', subgraphSecret)
        .send({
          query: 'mutation { refreshToken { accessToken } }',
        })
        .expect(200);

      expect(firstRefresh.body.errors).toBeUndefined();

      // Agent now has the NEW cookie from Set-Cookie — second refresh also succeeds
      const secondRefresh = await agent
        .post(rootUrl)
        .set('Router-Authorization', subgraphSecret)
        .send({
          query: 'mutation { refreshToken { accessToken } }',
        })
        .expect(200);

      expect(secondRefresh.body.errors).toBeUndefined();

      // Old token is dead — raw request with the original token fails
      const oldAttempt = await authPost(rootUrl)
        .set('Cookie', `refreshToken=${oldRefreshToken}`)
        .send({
          query: 'mutation { refreshToken { accessToken } }',
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
      const signInRes = await authPost(rootUrl)
        .send({
          query: `
            mutation SignIn($input: SignInInput!) {
              signIn(input: $input) {
                accessToken
                user { id }
              }
            }
          `,
          variables: { input: { email, password: 'password123' } },
        })
        .expect(200);

      const refreshTokenValue = refreshTokenFromCookie(signInRes);

      // Refresh
      const refreshRes = await authPost(rootUrl)
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

  describe('GitHub OAuth full flow', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeAll(() => {
      // Mock fetch to simulate GitHub API
      originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async (url: RequestInfo | URL) => {
        const urlStr = url.toString();

        if (urlStr.includes('github.com/login/oauth/access_token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'mock_github_token' }),
          } as Response;
        }

        if (
          urlStr.includes('api.github.com/user') &&
          !urlStr.includes('/emails')
        ) {
          return {
            ok: true,
            json: async () => ({
              id: 12345,
              login: 'oauth_test_user',
              email: null,
              avatar_url: null,
            }),
          } as Response;
        }

        if (urlStr.includes('api.github.com/user/emails')) {
          return {
            ok: true,
            json: async () => [
              {
                email: 'oauth-test@example.com',
                primary: true,
                verified: true,
              },
            ],
          } as Response;
        }

        return originalFetch(url);
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    const extractCodeFromRedirect = (location: string): string | null => {
      const match = location.match(/[?&]code=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    it('should complete full OAuth flow: login → callback → exchangeOAuthCode', async () => {
      // 1. Open login URL → get state in cookie (excluded from middleware — no Router-Authorization)
      const loginRes = await request(app.getHttpServer())
        .get('/api/v1/auth/github/login')
        .expect(302);

      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
      const stateMatch = cookieStr.match(/oauth_state=([^;]+)/);
      expect(stateMatch).not.toBeNull();
      const state = stateMatch![1];

      // 2. Simulate callback from GitHub (excluded from middleware — no Router-Authorization)
      const callbackRes = await request(app.getHttpServer())
        .get(
          '/api/v1/auth/github/callback?code=mock_github_code&state=' + state,
        )
        .set('Cookie', `oauth_state=${state}`)
        .expect(302);

      const location = callbackRes.headers['location'] as string;
      expect(location).toContain('/auth/callback?code=');

      // 3. Extract exchangeCode from the redirect URL
      const exchangeCode = extractCodeFromRedirect(location);
      expect(exchangeCode).not.toBeNull();

      // 4. Exchange the code for tokens (GraphQL — goes through middleware)
      const exchangeRes = await authPost('/api/v1')
        .send({
          query: `
            mutation {
              exchangeOAuthCode(input: { code: "${exchangeCode}" }) {
                accessToken
                user { id email username }
              }
            }
          `,
        })
        .expect(200);

      expect(exchangeRes.body.errors).toBeUndefined();
      expect(exchangeRes.body.data.exchangeOAuthCode.accessToken).toBeDefined();
      expect(exchangeRes.body.data.exchangeOAuthCode.user.email).toBe(
        'oauth-test@example.com',
      );
    });

    it('should reject already used exchange code', async () => {
      // 1. Go through OAuth callback to get an exchangeCode (excluded from middleware)
      const loginRes = await request(app.getHttpServer())
        .get('/api/v1/auth/github/login')
        .expect(302);

      const cookies = loginRes.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
      const stateMatch = cookieStr.match(/oauth_state=([^;]+)/);
      const state = stateMatch![1];

      const callbackRes = await request(app.getHttpServer())
        .get(
          '/api/v1/auth/github/callback?code=mock_github_code&state=' + state,
        )
        .set('Cookie', `oauth_state=${state}`)
        .expect(302);

      const location = callbackRes.headers['location'] as string;
      const exchangeCode = extractCodeFromRedirect(location)!;

      // 2. First call — succeeds (GraphQL — goes through middleware)
      const first = await authPost('/api/v1')
        .send({
          query: `
            mutation {
              exchangeOAuthCode(input: { code: "${exchangeCode}" }) {
                accessToken
              }
            }
          `,
        })
        .expect(200);

      expect(first.body.errors).toBeUndefined();

      // 3. Second call with the same code — should fail (GraphQL — goes through middleware)
      const second = await authPost('/api/v1')
        .send({
          query: `
            mutation {
              exchangeOAuthCode(input: { code: "${exchangeCode}" }) {
                accessToken
              }
            }
          `,
        })
        .expect(200);

      expect(second.body.data).toBeNull();
      expect(second.body.errors[0].message).toContain(
        'Exchange code already used',
      );
    });
  });
});
