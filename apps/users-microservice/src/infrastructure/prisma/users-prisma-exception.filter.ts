import { ArgumentsHost, Catch } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { Prisma } from '../../../../../prisma/apps/users/src/generated/prisma/users-client';
import { mapPrismaErrorCode } from '@app/common';

@Catch(Prisma.PrismaClientKnownRequestError)
export class UsersPrismaExceptionFilter implements GqlExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, _host: ArgumentsHost) {
    const mapped = mapPrismaErrorCode(exception.code);

    if (mapped) {
      throw mapped;
    }

    return exception;
  }
}
