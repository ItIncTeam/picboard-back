import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
//import * as request from 'supertest';
import { default as request } from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthModule } from '@app/auth';

@Module({})
class MockAuthModule {}

describe('Users subgraph (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(AuthModule)
      .useModule(MockAuthModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should expose graphql endpoint', async () => {
    const query = `
      query {
        __typename
      }
    `;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data).toBeDefined();
  });

  it('should register a user', async () => {
    const mutation = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          id
          email
          username
        }
      }
    `;

    const variables = {
      input: {
        email: 'jane@example.com',
        username: 'jane',
        password: 'password123',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation, variables })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.register.email).toBe('jane@example.com');
    expect(res.body.data.register.username).toBe('jane');
    expect(res.body.data.register.id).toBeDefined();
  });

  it('should login registered user', async () => {
    const mutation = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken
          user {
            id
            email
            username
          }
        }
      }
    `;

    const variables = {
      input: {
        email: 'jane@example.com',
        password: 'password123',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation, variables })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.login.accessToken).toBeDefined();
    expect(res.body.data.login.user.email).toBe('jane@example.com');
    expect(res.body.data.login.user.username).toBe('jane');
  });

  it('should reject invalid login', async () => {
    const mutation = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken
          user {
            id
            email
            username
          }
        }
      }
    `;

    const variables = {
      input: {
        email: 'jane@example.com',
        password: 'wrong-password',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation, variables })
      .expect(200);

    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('Invalid credentials');
  });
});
