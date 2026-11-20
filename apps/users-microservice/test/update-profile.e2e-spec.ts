import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { default as request } from 'supertest';
import cookieParser from 'cookie-parser';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { AppModule } from '../src/app.module';
import { AuthModule } from '@app/auth';
import { RecaptchaGuard } from '@app/common';
import { createValidationPipe } from '@app/common/validation/create-validation-pipe';
import { UsersPrismaService } from '../src/infrastructure/prisma/users-prisma.service';
import { EmailAdapter } from '../src/infrastructure/messaging/email.adapter';

@Module({})
class MockAuthModule {}

class MockEmailAdapter {
  sendEmail() {
    return { messageId: 'mock' };
  }
}

const rootUrl = '/api/v1';
const subgraphSecret = 'users-secret';
const PASSWORD = 'Password123';

const uniqueEmail = () =>
  `a4-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

// username: 6..30 chars, ^[A-Za-z0-9!_-]+$
const uniqueUsername = (prefix: string) =>
  `${prefix}_${Date.now().toString().slice(-8)}`;

const isoYearsAgo = (years: number): string => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
};

const fieldNamesOf = (schema: GraphQLSchema, typeName: string): string[] => {
  const type = schema.getType(typeName);
  if (!(type instanceof GraphQLObjectType)) {
    throw new Error(`${typeName} is not a GraphQL object type`);
  }
  return Object.keys(type.getFields()).sort();
};

const UPDATE_PROFILE_MUTATION = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      username
      email
      isConfirmed
      firstName
      lastName
      displayName
      dateOfBirth
      aboutMe
      countryId
      cityId
      country { id name nameRu }
      city { id name nameRu }
    }
  }
`;

const SIGN_UP_MUTATION = `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      user { id email username isConfirmed }
      message
    }
  }
`;

const ME_QUERY = `
  query {
    me {
      id
      email
      username
      firstName
      lastName
      displayName
      dateOfBirth
      aboutMe
      countryId
      cityId
    }
  }
`;

describe('Update Profile (e2e)', () => {
  let app: INestApplication;
  let prisma: UsersPrismaService;

  const authPost = (url: string) =>
    request(app.getHttpServer())
      .post(url)
      .set('Router-Authorization', subgraphSecret);

  const authedPost = (userId: string) =>
    authPost(rootUrl).set('x-user-id', userId);

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
    app.useGlobalPipes(createValidationPipe());
    await app.init();

    prisma = app.get(UsersPrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'a4-e2e-' } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  const signUpUser = async (prefix: string) => {
    const email = uniqueEmail();
    const username = uniqueUsername(prefix);

    const res = await authPost(rootUrl).send({
      query: SIGN_UP_MUTATION,
      variables: {
        input: {
          email,
          username,
          password: PASSWORD,
          acceptTerms: true,
          acceptPrivacy: true,
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const id = res.body.data.signUp.user.id as string;
    await prisma.user.update({ where: { id }, data: { isConfirmed: true } });

    return { id, email, username };
  };

  const getDeLocation = async () => {
    const country = await prisma.country.findFirst({ where: { code: 'DE' } });
    if (!country) throw new Error('DE country is missing in seed');
    const city = await prisma.city.findFirst({
      where: { countryId: country.id },
    });
    if (!city) throw new Error('DE city is missing in seed');
    return { country, city };
  };

  const getFrCity = async () => {
    const country = await prisma.country.findFirst({ where: { code: 'FR' } });
    if (!country) throw new Error('FR country is missing in seed');
    const city = await prisma.city.findFirst({
      where: { countryId: country.id },
    });
    if (!city) throw new Error('FR city is missing in seed');
    return { country, city };
  };

  it('should update profile with all fields', async () => {
    const user = await signUpUser('upd');
    const { country, city } = await getDeLocation();
    const birthDate = isoYearsAgo(20);

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'First',
          lastName: 'Last',
          dateOfBirth: birthDate,
          countryId: country.id,
          cityId: city.id,
          aboutMe: 'Some bio',
        },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();

    const data = res.body.data.updateProfile;
    expect(data.firstName).toBe('First');
    expect(data.lastName).toBe('Last');
    expect(data.aboutMe).toBe('Some bio');
    expect(data.dateOfBirth).toBe(birthDate);
    expect(data.countryId).toBe(country.id);
    expect(data.cityId).toBe(city.id);
    expect(data.displayName).toBe('First Last');
  });

  it('should round-trip: me returns the same values after update', async () => {
    const user = await signUpUser('trip');
    const { country, city } = await getDeLocation();

    const updateRes = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Round',
          lastName: 'Trip',
          dateOfBirth: '1990-01-01',
          countryId: country.id,
          cityId: city.id,
          aboutMe: 'Round trip bio',
        },
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.errors).toBeUndefined();

    const meRes = await authedPost(user.id).send({ query: ME_QUERY });

    expect(meRes.status).toBe(200);
    expect(meRes.body.errors).toBeUndefined();

    const me = meRes.body.data.me;
    expect(me.firstName).toBe('Round');
    expect(me.lastName).toBe('Trip');
    expect(me.displayName).toBe('Round Trip');
    expect(me.aboutMe).toBe('Round trip bio');
    expect(me.dateOfBirth).toBe('1990-01-01');
    expect(me.countryId).toBe(country.id);
    expect(me.cityId).toBe(city.id);
  });

  it('should reject anonymous access without x-user-id', async () => {
    await signUpUser('anon');

    const meRes = await authPost(rootUrl).send({ query: ME_QUERY });

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.me).toBeNull();
    expect(meRes.body.errors).toBeDefined();
    expect(meRes.body.errors[0].extensions.statusCode).toBe(401);

    const updateRes = await authPost(rootUrl).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: 'anonymous_user',
          firstName: 'Anon',
          lastName: 'Ymous',
        },
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data).toBeNull();
    expect(updateRes.body.errors[0].extensions.statusCode).toBe(401);
  });

  it('should reject dateOfBirth of a 10 year old with USER_UNDER_13', async () => {
    const user = await signUpUser('age');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Kid',
          lastName: 'Small',
          dateOfBirth: isoYearsAgo(10),
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('USER_UNDER_13');
    expect(error.extensions.statusCode).toBe(400);
    expect(error.extensions.errors[0].field).toBe('dateOfBirth');
  });

  it('should reject dateOfBirth in the future with DATE_IN_FUTURE', async () => {
    const user = await signUpUser('future');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Future',
          lastName: 'Date',
          dateOfBirth: isoYearsAgo(-5),
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('DATE_IN_FUTURE');
    expect(error.extensions.statusCode).toBe(400);
    expect(error.extensions.errors[0].field).toBe('dateOfBirth');
  });

  it('should reject non-existent calendar date 31 Feb with BAD_USER_INPUT', async () => {
    const user = await signUpUser('feb31');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Feb',
          lastName: 'Thirty',
          dateOfBirth: '2000-02-31',
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(error.extensions.errors[0].field).toBe('dateOfBirth');
  });

  it('should reject city from another country with CITY_NOT_IN_COUNTRY', async () => {
    const user = await signUpUser('city');
    const { country } = await getDeLocation();
    const { city: frCity } = await getFrCity();

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'City',
          lastName: 'Check',
          countryId: country.id,
          cityId: frCity.id,
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('CITY_NOT_IN_COUNTRY');
    expect(error.extensions.statusCode).toBe(400);
    expect(error.extensions.errors[0].field).toBe('cityId');
  });

  it('should reject non-existent countryId with field error', async () => {
    const user = await signUpUser('ctry');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'No',
          lastName: 'Country',
          countryId: '00000000-0000-4000-8000-000000000000',
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(error.extensions.statusCode).toBe(400);
    expect(error.extensions.errors[0].field).toBe('countryId');
    expect(error.extensions.errors[0].message).toBe('Country not found');
  });

  it('should clear countryId and cityId when countryId is null', async () => {
    const user = await signUpUser('clear');
    const { country, city } = await getDeLocation();
    const baseInput = {
      username: user.username,
      firstName: 'Clear',
      lastName: 'City',
    };

    const firstRes = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: { ...baseInput, countryId: country.id, cityId: city.id },
      },
    });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.errors).toBeUndefined();
    expect(firstRes.body.data.updateProfile.cityId).toBe(city.id);

    const secondRes = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: { input: { ...baseInput, countryId: null } },
    });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.errors).toBeUndefined();

    const data = secondRes.body.data.updateProfile;
    expect(data.countryId).toBeNull();
    expect(data.cityId).toBeNull();
  });

  it('should reject aboutMe longer than 200 characters', async () => {
    const user = await signUpUser('bio');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Long',
          lastName: 'Bio',
          aboutMe: 'x'.repeat(201),
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(error.extensions.statusCode).toBe(400);
    expect(error.extensions.errors[0].field).toBe('aboutMe');
  });

  it('should reject non-letter characters in firstName', async () => {
    const user = await signUpUser('name');

    const res = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'John123',
          lastName: 'Doe',
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(error.extensions.errors[0].field).toBe('firstName');
    expect(error.extensions.errors[0].message).toBe(
      'Only letters, spaces, hyphens and apostrophes',
    );
  });

  it('should reject occupied username with USERNAME_TAKEN (409)', async () => {
    const owner = await signUpUser('own');
    const other = await signUpUser('other');

    const res = await authedPost(owner.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: other.username,
          firstName: 'Taken',
          lastName: 'Name',
        },
      },
    });

    expect(res.status).toBe(200);
    const error = res.body.errors[0];
    expect(error.extensions.code).toBe('USERNAME_TAKEN');
    expect(error.extensions.statusCode).toBe(409);
    expect(error.extensions.errors[0].field).toBe('username');
  });

  it('should read the updated profile back via public user(id)', async () => {
    const user = await signUpUser('read');

    const updateRes = await authedPost(user.id).send({
      query: UPDATE_PROFILE_MUTATION,
      variables: {
        input: {
          username: user.username,
          firstName: 'Updated',
          lastName: 'Name',
          aboutMe: 'Updated bio',
        },
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.errors).toBeUndefined();

    const userRes = await authPost(rootUrl).send({
      query: `
        query User($id: String!) {
          user(id: $id) {
            id
            username
            firstName
            lastName
            displayName
            aboutMe
          }
        }
      `,
      variables: { id: user.id },
    });

    expect(userRes.status).toBe(200);
    expect(userRes.body.errors).toBeUndefined();

    const publicUser = userRes.body.data.user;
    expect(publicUser.firstName).toBe('Updated');
    expect(publicUser.lastName).toBe('Name');
    expect(publicUser.displayName).toBe('Updated Name');
    expect(publicUser.aboutMe).toBe('Updated bio');
  });

  // Guard against accidental surface growth: `updateProfile` returns `Me`, so every
  // field added to `Me`/`User` becomes selectable through this mutation as well.
  // Any change here must be a reviewed decision (see profile contract doc).
  it('should expose exactly the reviewed field sets on Me and User', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    expect(fieldNamesOf(schema, 'Me')).toEqual([
      'aboutMe',
      'avatar',
      'city',
      'cityId',
      'country',
      'countryId',
      'dateOfBirth',
      'displayName',
      'email',
      'firstName',
      'id',
      'isConfirmed',
      'lastName',
      'profilePictureFileId',
      'username',
    ]);

    expect(fieldNamesOf(schema, 'User')).toEqual([
      'aboutMe',
      'avatar',
      'city',
      'cityId',
      'country',
      'countryId',
      'displayName',
      'firstName',
      'id',
      'lastName',
      'profilePictureFileId',
      'username',
    ]);
  });
});
