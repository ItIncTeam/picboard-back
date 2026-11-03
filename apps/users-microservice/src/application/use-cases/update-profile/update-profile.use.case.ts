import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { CityRepository } from '../../../domain/repositories/city.repository';
import { CountryRepository } from '../../../domain/repositories/country.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { UpdateProfileInput } from '../../../graphql/inputs/update-profile.input';
import { UpdateProfileData } from '../../../domain/repositories/update-profile-data.type';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';

export class UpdateProfileCommand {
  constructor(
    public ownerId: string,
    public input: UpdateProfileInput,
  ) {}
}

export function calculateAge(dateOfBirth: Date, now: Date): number {
  // Use UTC to avoid timezone skew: dateOfBirth is parsed from YYYY-MM-DD as UTC-midnight,
  // so comparison must be in the same UTC scale to correctly compute age across timezones.
  const birthYear = dateOfBirth.getUTCFullYear();
  const birthMonth = dateOfBirth.getUTCMonth();
  const birthDay = dateOfBirth.getUTCDate();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

  let age = nowYear - birthYear;
  if (nowMonth < birthMonth || (nowMonth === birthMonth && nowDay < birthDay)) {
    age--;
  }
  return age;
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileUseCase implements ICommandHandler<
  UpdateProfileCommand,
  UserEntity
> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cityRepository: CityRepository,
    private readonly countryRepository: CountryRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<UserEntity> {
    const { ownerId, input } = command;

    const data: UpdateProfileData = {};

    data.username = input.username;
    data.firstName = input.firstName;
    data.lastName = input.lastName;

    // dateOfBirth: absent → don't change; null → clear
    if (input.dateOfBirth !== undefined) {
      if (input.dateOfBirth == null) {
        data.dateOfBirth = null;
      } else {
        const date = new Date(input.dateOfBirth);
        const now = new Date();

        // Защита от непарсящейся даты: иначе в Prisma уедет Invalid Date и получится 500 вместо 400.
        if (Number.isNaN(date.getTime())) {
          throw new BadRequestException({
            message: 'dateOfBirth is not a valid date',
            errors: [
              {
                field: 'dateOfBirth',
                message: 'dateOfBirth is not a valid date',
              },
            ],
          });
        }

        // Будущая дата — отдельная ошибка (сейчас она маскировалась под USER_UNDER_13).
        // Сравниваем с сегодняшней UTC-полуночью: «сегодня» будущим не считается.
        const todayUtc = Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
        );
        if (date.getTime() > todayUtc) {
          throw new BadRequestException({
            message: 'Date of birth cannot be in the future.',
            domainCode: 'DATE_IN_FUTURE',
            errors: [
              {
                field: 'dateOfBirth',
                message: 'Date of birth cannot be in the future.',
              },
            ],
          });
        }

        const age = calculateAge(date, now);
        if (age < 13) {
          throw new BadRequestException({
            message: 'A user under 13 cannot create a profile.',
            domainCode: 'USER_UNDER_13',
            errors: [
              {
                field: 'dateOfBirth',
                message: 'Age must be at least 13',
              },
            ],
          });
        }
        data.dateOfBirth = date;
      }
    }

    // (c) Load current user once if needed
    let currentUser: UserEntity | undefined;
    let effectiveCountryId: string | null | undefined;

    const needsUserLoad =
      (input.cityId != null && input.countryId === undefined) ||
      input.countryId != null;

    if (needsUserLoad) {
      // Без каста: findById может вернуть null (пользователя нет) — не притворяемся, что он есть.
      currentUser = (await this.usersRepository.findById(ownerId)) ?? undefined;
    }

    if (input.countryId !== undefined) {
      if (input.countryId === null) {
        data.countryId = null;
        data.cityId = null;
      } else {
        const country = await this.countryRepository.findById(input.countryId!);
        if (!country) {
          throw new BadRequestException({
            message: 'Country not found',
            errors: [
              {
                field: 'countryId',
                message: 'Country not found',
              },
            ],
          });
        }
        data.countryId = input.countryId;
        effectiveCountryId = input.countryId;
      }
    } else if (needsUserLoad && currentUser) {
      effectiveCountryId = currentUser.countryId;
    }

    // (b) (c) Validation order and city/country validation
    if (input.cityId != null) {
      // (b) First check: effective country must be set together with city
      if (effectiveCountryId == null) {
        throw new BadRequestException({
          message: 'Country must be set together with city',
          errors: [
            {
              field: 'cityId',
              message: 'Country must be set together with city',
            },
          ],
        });
      }

      const city = await this.cityRepository.findById(input.cityId);
      if (!city) {
        throw new BadRequestException({
          message: 'City not found',
          errors: [
            {
              field: 'cityId',
              message: 'City not found',
            },
          ],
        });
      }
      if (city.countryId !== effectiveCountryId) {
        throw new BadRequestException({
          message: 'City does not belong to the selected country',
          domainCode: 'CITY_NOT_IN_COUNTRY',
          errors: [
            {
              field: 'cityId',
              message: 'City does not belong to the selected country',
            },
          ],
        });
      }
    }

    // Assign cityId to data after successful validation
    if (input.cityId !== undefined) {
      data.cityId = input.cityId;
    }

    // If countryId changed and cityId not in input → clear cityId
    if (
      input.countryId != null &&
      currentUser?.countryId !== input.countryId &&
      input.cityId === undefined
    ) {
      data.cityId = null;
    }

    // aboutMe: absent → don't change; null → clear (set bio to null)
    if (input.aboutMe !== undefined) {
      // Пустая строка после trim — это «не заполнено»: храним null, а не ''.
      data.aboutMe =
        input.aboutMe && input.aboutMe.trim() !== '' ? input.aboutMe : null;
    }

    // Check username uniqueness
    if (input.username !== undefined) {
      const existingUser = await this.usersRepository.findByUsername(
        input.username,
      );
      if (existingUser && existingUser.id !== ownerId) {
        throw new ConflictException({
          message: 'Username is already taken.',
          domainCode: 'USERNAME_TAKEN',
          errors: [
            {
              field: 'username',
              message: 'Username is already taken.',
            },
          ],
        });
      }
    }

    try {
      return await this.usersRepository.updateProfile(ownerId, data);
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Username is already taken.',
          domainCode: 'USERNAME_TAKEN',
          errors: [
            {
              field: 'username',
              message: 'Username is already taken.',
            },
          ],
        });
      }
      throw error;
    }
  }
}
