import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class RecaptchaV3Service {
  private readonly logger: Logger = new Logger(RecaptchaV3Service.name);

  constructor(private readonly appConfig: AppConfig) {}

  async ensureHuman(token: string, expectedAction: string): Promise<void> {
    const secret: string = this.appConfig.recaptchaSecret;
    const minScore: number = this.appConfig.recaptchaMinScore;

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(
        token,
      )}`,
    });

    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      'error-codes'?: string[];
    };

    if (!data.success) {
      this.logger.warn(`reCAPTCHA failed: ${data['error-codes']?.join(',')}`);
      throw new BadRequestException('Captcha verification failed');
    }

    if (data.action && data.action !== expectedAction) {
      this.logger.warn(`reCAPTCHA action mismatch: ${data.action}`);
      throw new BadRequestException('Captcha verification failed');
    }

    if (typeof data.score === 'number' && data.score < minScore) {
      this.logger.warn(`reCAPTCHA low score: ${data.score}`);
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
