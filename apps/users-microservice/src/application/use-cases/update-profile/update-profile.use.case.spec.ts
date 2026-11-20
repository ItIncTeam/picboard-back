import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { CityRepository } from '../../../domain/repositories/city.repository';
import { CountryRepository } from '../../../domain/repositories/country.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { UpdateProfileUseCase, calculateAge } from './update-profile.use.case';
import { UpdateProfileCommand } from './update-profile.use.case';
import { UpdateProfileData } from '../../../domain/repositories/update-profile-data.type';
import { UpdateProfileInput } from '../../../graphql/inputs/update-profile.input';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';

function createUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return new UserEntity(
    overrides.id ?? 'user-1',
    overrides.email ?? 'test@example.com',
    overrides.username ?? 'testuser',
    overrides.passwordHash ?? '$2b$10$hashedpassword',
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.confirmationCode ?? 'conf-code-123',
    overrides.confirmationCodeExpDate ?? new Date('2026-06-01'),
    overrides.isConfirmed ?? true,
    overrides.aboutMe,
    overrides.profilePictureFileId,
    overrides.firstName,
    overrides.lastName,
    overrides.dateOfBirth,
    overrides.countryId,
    overrides.cityId,
  );
}

const defaultUser = createUser({
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  dateOfBirth: new Date('2000-01-01'),
  countryId: 'country-1',
  cityId: 'city-1',
});

// Обязательные поля по ТЗ (username/firstName/lastName) задаются здесь один раз,
// чтобы тесты конкретных правил не повторяли их в каждом литерале.
const makeInput = (
  overrides: Partial<UpdateProfileInput> = {},
): UpdateProfileInput => ({
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  ...overrides,
});

const mockCityEntity = {
  id: 'city-1',
  name: 'Test City',
  nameRu: null,
  countryId: 'country-1',
  population: 1000000,
};

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;
  let usersRepository: jest.Mocked<UsersRepository>;
  let cityRepository: jest.Mocked<CityRepository>;
  let countryRepository: jest.Mocked<CountryRepository>;

  beforeEach(async () => {
    usersRepository = {
      findById: jest.fn().mockResolvedValue(defaultUser),
      findByIds: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      confirmUserEmail: jest.fn(),
      updateConfirmationData: jest.fn(),
      updatePasswordHash: jest.fn(),
      count: jest.fn(),
      updateProfile: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    cityRepository = {
      search: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
    };

    countryRepository = {
      search: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'country-1',
        code: 'DE',
        name: 'Germany',
        nameRu: 'Германия',
      }),
      findByIds: jest.fn(),
    } as unknown as jest.Mocked<CountryRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProfileUseCase,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: CityRepository, useValue: cityRepository },
        { provide: CountryRepository, useValue: countryRepository },
      ],
    }).compile();

    useCase = module.get(UpdateProfileUseCase);
  });

  describe('calculateAge', () => {
    it('should return 13 for exactly 13 years', () => {
      const birthDate = new Date('2013-01-01');
      const now = new Date('2026-01-01');
      const age = calculateAge(birthDate, now);
      expect(age).toBe(13);
    });

    it('should return 12 for 13 years minus 1 day', () => {
      const birthDate = new Date('2013-01-02');
      const now = new Date('2026-01-01');
      const age = calculateAge(birthDate, now);
      expect(age).toBe(12);
    });

    it('should return 13 for UTC date 2013-05-17 to 2026-05-17', () => {
      const age = calculateAge(
        new Date('2013-05-17T00:00:00.000Z'),
        new Date('2026-05-17T00:00:00.000Z'),
      );
      expect(age).toBe(13);
    });

    it('should return 12 for UTC date 2013-05-17 to 2026-05-16', () => {
      const age = calculateAge(
        new Date('2013-05-17T00:00:00.000Z'),
        new Date('2026-05-16T23:59:59.000Z'),
      );
      expect(age).toBe(12);
    });

    it('should return 13 for UTC date 2012-12-31 to 2026-01-01', () => {
      const age = calculateAge(
        new Date('2012-12-31T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      );
      expect(age).toBe(13);
    });

    it('should return 13 for UTC date 2013-01-01 to 2026-01-01 (exact birthday)', () => {
      const age = calculateAge(
        new Date('2013-01-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      );
      expect(age).toBe(13);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should update profile with all fields', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(user);

      const command = new UpdateProfileCommand('user-1', {
        username: 'testuser',
        firstName: 'Updated',
        lastName: 'Name',
        dateOfBirth: '1990-05-15',
        countryId: 'country-1',
        cityId: 'city-1',
        aboutMe: 'Updated bio',
      });

      const result = await useCase.execute(command);

      expect(result).toEqual(user);
      expect(usersRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name',
          dateOfBirth: new Date('1990-05-15'),
          aboutMe: 'Updated bio',
        }),
      );
    });
  });

  describe('dateOfBirth validation', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should allow age exactly 13', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(user);

      const birthDate = new Date('2013-01-01');

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ dateOfBirth: birthDate.toISOString().split('T')[0] }),
      );

      const result = await useCase.execute(command);
      expect(result).toEqual(user);
    });

    it('should reject age under 13 with BadRequestException', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(user);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ dateOfBirth: '2014-01-01' }),
      );

      await expect(useCase.execute(command)).rejects.toMatchObject({
        response: {
          domainCode: 'USER_UNDER_13',
          message: 'A user under 13 cannot create a profile.',
          errors: [{ field: 'dateOfBirth', message: 'Age must be at least 13' }],
        },
      });
    });

    it('should reject dateOfBirth in the future with DATE_IN_FUTURE', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      const future = new Date();
      future.setUTCFullYear(future.getUTCFullYear() + 1);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ dateOfBirth: future.toISOString().slice(0, 10) }),
      );

      await expect(useCase.execute(command)).rejects.toMatchObject({
        response: {
          domainCode: 'DATE_IN_FUTURE',
          errors: [{ field: 'dateOfBirth' }],
        },
      });
    });

    it('should reject unparsable dateOfBirth', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ dateOfBirth: 'not-a-date' }),
      );

      await expect(useCase.execute(command)).rejects.toMatchObject({
        response: {
          errors: [{ field: 'dateOfBirth' }],
        },
      });
    });

    it('should clear dateOfBirth when null is passed', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(
        new UserEntity(
          user.id,
          user.email,
          user.username,
          user.passwordHash,
          user.createdAt,
          user.confirmationCode,
          user.confirmationCodeExpDate,
          user.isConfirmed,
          user.aboutMe,
          user.profilePictureFileId,
          user.firstName,
          user.lastName,
          null,
          user.countryId,
          user.cityId,
        ),
      );

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ dateOfBirth: null }),
      );

      const result = await useCase.execute(command);
      expect(result.dateOfBirth).toBeNull();
    });
  });

  describe('city validation', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should reject non-existent city with CITY_NOT_FOUND (no domainCode)', async () => {
      cityRepository.findById.mockResolvedValue(null);
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ cityId: 'nonexistent-city', countryId: 'country-1' }),
      );

      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await useCase.execute(command);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.domainCode).toBeUndefined();
        expect(e.response.errors[0].field).toBe('cityId');
        expect(e.response.errors[0].message).toBe('City not found');
      }
    });

    it('should reject non-existent country with field error', async () => {
      countryRepository.findById.mockResolvedValue(null);
      usersRepository.findByUsername.mockResolvedValue(null);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ countryId: '00000000-0000-4000-8000-000000000000' }),
      );

      await expect(useCase.execute(command)).rejects.toMatchObject({
        response: {
          message: 'Country not found',
          errors: [{ field: 'countryId', message: 'Country not found' }],
        },
      });
    });

    it('should reject city from another country with CITY_NOT_IN_COUNTRY', async () => {
      cityRepository.findById.mockResolvedValue(
        new (class CityEntityStub {
          constructor(
            public id: string,
            public name: string,
            public nameRu: string | null,
            public countryId: string,
            public population: number | null,
          ) {}
        })('city-2', 'Another City', null, 'country-2', null),
      );
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ cityId: 'city-2', countryId: 'country-1' }),
      );

      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await useCase.execute(command);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.domainCode).toBe('CITY_NOT_IN_COUNTRY');
        expect(e.response.errors[0].field).toBe('cityId');
        expect(e.response.errors[0].message).toBe(
          'City does not belong to the selected country',
        );
      }
    });

    it('should not clear city when cityId is absent from input', async () => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ firstName: 'Updated' }),
      );

      const result = await useCase.execute(command);
      expect(result.cityId).toBe(defaultUser.cityId);
    });

    it('should clear cityId when countryId is explicitly null', async () => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(
        new UserEntity(
          defaultUser.id,
          defaultUser.email,
          defaultUser.username,
          defaultUser.passwordHash,
          defaultUser.createdAt,
          defaultUser.confirmationCode,
          defaultUser.confirmationCodeExpDate,
          defaultUser.isConfirmed,
          defaultUser.aboutMe,
          defaultUser.profilePictureFileId,
          defaultUser.firstName,
          defaultUser.lastName,
          defaultUser.dateOfBirth,
          null,
          null,
        ),
      );

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ countryId: null }),
      );

      const result = await useCase.execute(command);
      expect(result.countryId).toBeNull();
      expect(result.cityId).toBeNull();
    });

    it('should reject city when user has no country but input has cityId → Country must be set together with city', async () => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
      usersRepository.findByUsername.mockResolvedValue(null);

      // Mock findById to return a user without countryId
      usersRepository.findById.mockResolvedValue(
        createUser({
          id: 'user-no-country',
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: new Date('2000-01-01'),
          // No countryId set
        }),
      );

      const command = new UpdateProfileCommand(
        'user-no-country',
        makeInput({ cityId: 'city-1' }),
      );

      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      try {
        await useCase.execute(command);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.domainCode).toBeUndefined();
        expect(e.response.errors[0].field).toBe('cityId');
        expect(e.response.errors[0].message).toBe(
          'Country must be set together with city',
        );
      }
    });

    it('should succeed when user DE + city DE and no countryId in input (effective country from DB)', async () => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ cityId: 'city-1' }),
      );

      // User has countryId 'country-1' in DB, city has countryId 'country-1'
      // No countryId in input → effective country from DB → should succeed
      const result = await useCase.execute(command);
      expect(result.cityId).toBe('city-1');
    });
  });

  describe('username validation', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should allow same username for owner', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(user);
      usersRepository.updateProfile.mockResolvedValue(user);

      const command = new UpdateProfileCommand('user-1', makeInput());

      const result = await useCase.execute(command);
      expect(result).toEqual(user);
    });

    it('should reject username taken for different user with ConflictException 409', async () => {
      usersRepository.findByUsername.mockResolvedValue(
        createUser({ id: 'user-2', username: 'testuser' }),
      );
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand('user-1', makeInput());

      await expect(useCase.execute(command)).rejects.toThrow(ConflictException);
      try {
        await useCase.execute(command);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getStatus()).toBe(409);
        expect(e.response.domainCode).toBe('USERNAME_TAKEN');
        expect(e.response.errors[0].field).toBe('username');
        expect(e.response.errors[0].message).toBe('Username is already taken.');
      }
    });

    it('should allow different username', async () => {
      const user = defaultUser;
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(user);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ username: 'newusername' }),
      );

      const result = await useCase.execute(command);
      expect(result).toEqual(user);
    });

    it('should store empty aboutMe as null', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);
      usersRepository.updateProfile.mockResolvedValue(defaultUser);

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ aboutMe: '   ' }),
      );

      await useCase.execute(command);

      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ aboutMe: null }),
      );
    });
  });

  describe('P2002 race condition', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should map P2002 to ConflictException (409)', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`username`)',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
          meta: { target: ['username'] },
        },
      );
      usersRepository.updateProfile.mockRejectedValue(prismaError);

      const command = new UpdateProfileCommand('user-1', makeInput());

      await expect(useCase.execute(command)).rejects.toThrow(ConflictException);
      try {
        await useCase.execute(command);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getStatus()).toBe(409);
        expect(e.response.domainCode).toBe('USERNAME_TAKEN');
        expect(e.response.errors[0].field).toBe('username');
        expect(e.response.errors[0].message).toBe('Username is already taken.');
      }
    });
  });

  describe('city country validation - effective country', () => {
    beforeEach(() => {
      cityRepository.findById.mockResolvedValue(mockCityEntity);
    });

    it('should clear cityId when countryId changes without cityId in input', async () => {
      const userWithNewCountry = createUser({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: new Date('2000-01-01'),
        countryId: 'country-2',
        cityId: 'city-2',
      });

      usersRepository.findByUsername.mockResolvedValue(null);
      // Spy on updateProfile to check the data argument
      usersRepository.updateProfile.mockImplementation(
        async (id: string, data: UpdateProfileData) => {
          return new UserEntity(
            id,
            userWithNewCountry.email,
            userWithNewCountry.username,
            userWithNewCountry.passwordHash,
            userWithNewCountry.createdAt,
            userWithNewCountry.confirmationCode,
            userWithNewCountry.confirmationCodeExpDate,
            userWithNewCountry.isConfirmed,
            userWithNewCountry.aboutMe,
            userWithNewCountry.profilePictureFileId,
            userWithNewCountry.firstName,
            userWithNewCountry.lastName,
            data.dateOfBirth != null
              ? data.dateOfBirth
              : userWithNewCountry.dateOfBirth,
            data.countryId != null
              ? data.countryId
              : userWithNewCountry.countryId,
            data.cityId != null ? data.cityId : userWithNewCountry.cityId,
          );
        },
      );

      const command = new UpdateProfileCommand(
        'user-1',
        makeInput({ countryId: 'country-3' }),
      );

      await useCase.execute(command);
      expect(usersRepository.updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ cityId: null }),
      );
    });
  });
});
