import { Injectable } from '@nestjs/common';
import { ConsentRepository } from '../../../../domain/repositories/consent/consent.repository';
import { ConsentEnumMapper } from '../../mappers/consent-enum.mapper';
import { UsersPrismaService } from '../../users-prisma.service';
import { UserConsentEntity } from '../../../../domain/entities/user-consent.entity';
import { CreateUserConsentData } from '../../../../domain/repositories/consent/create-user-consent-data.type';
import { UserConsent } from '../../../../../../../prisma/apps/users/src/generated/prisma/users-client';

@Injectable()
export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly prisma: UsersPrismaService) {}

  async createConsent(data: CreateUserConsentData): Promise<UserConsentEntity> {
    const prismaType = ConsentEnumMapper.toPrismaLegalDocumentType(data.type);
    const prismaAction = ConsentEnumMapper.toPrismaConsentAction(data.action);

    const result: UserConsent = await this.prisma.userConsent.create({
      data: {
        userId: data.userId,
        type: prismaType,
        action: prismaAction,
      },
    });

    return new UserConsentEntity(
      result.id,
      result.userId,
      result.type,
      result.action,
      result.createdAt,
    );
  }
}
