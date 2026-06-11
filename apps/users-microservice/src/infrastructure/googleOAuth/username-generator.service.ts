import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../domain/repositories/users.repository';

@Injectable()
export class UsernameGeneratorService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async generate(input: {
    email: string;
    displayName?: string;
  }): Promise<string> {
    const base = this.normalize(
      input.displayName || input.email.split('@')[0] || 'user',
    );

    let candidate = base;
    let counter = 0;

    while (await this.usersRepository.findByUsername(candidate)) {
      counter += 1;
      candidate = `${base}${counter}`;
    }

    return candidate;
  }

  private normalize(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._]/g, '')
        .slice(0, 20) || 'user'
    );
  }
}
