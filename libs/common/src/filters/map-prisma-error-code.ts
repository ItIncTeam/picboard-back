import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export function mapPrismaErrorCode(code: string): HttpException | null {
  // 409 Conflict
  if (code === 'P2002') {
    return new ConflictException('Resource already exists');
  }

  // 404 Not Found
  if (
    code === 'P2001' ||
    code === 'P2015' ||
    code === 'P2018' ||
    code === 'P2025'
  ) {
    return new NotFoundException('Resource not found');
  }

  // 400 Bad Request
  if (
    code === 'P2000' ||
    code === 'P2003' ||
    code === 'P2004' ||
    code === 'P2005' ||
    code === 'P2006' ||
    code === 'P2007' ||
    code === 'P2011' ||
    code === 'P2012' ||
    code === 'P2014' ||
    code === 'P2019' ||
    code === 'P2020' ||
    code === 'P2023' ||
    code === 'P2008' ||
    code === 'P2009' ||
    code === 'P2016' ||
    code === 'P2017' ||
    code === 'P2026'
  ) {
    return new BadRequestException('Database validation failed');
  }

  // 500 Internal Server Error
  if (
    code === 'P2010' ||
    code === 'P2024' ||
    code === 'P2027' ||
    code === 'P2021' ||
    code === 'P2022' ||
    code === 'P2038' ||
    code === 'P2039'
  ) {
    return new InternalServerErrorException('Database error');
  }

  return null;

  /*switch (code) {
    case 'P2002':
      return new ConflictException('Resource already exists');

    case 'P2025':
      return new NotFoundException('Resource not found');

    case 'P2003':
      return new BadRequestException('Invalid related resource reference');

    default:
      return null;
  }*/
}

/*@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements GqlExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, _host: ArgumentsHost) {
    switch (exception.code) {
      case 'P2002':
        throw new ConflictException('Resource already exists');

      case 'P2025':
        throw new NotFoundException('Resource not found');

      case 'P2003':
        throw new BadRequestException('Invalid related resource reference');

      default:
        throw exception;
    }
  }
}*/
