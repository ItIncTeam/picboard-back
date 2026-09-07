import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class EmailAdapter {
  constructor(private readonly appConfig: AppConfig) {}

  async sendEmail(email: string, subject: string, message: string) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.mail.ru',
      service: 'mail',
      port: 465,
      secure: true,
      ignoreTLS: true,
      auth: {
        user: this.appConfig.nodeMailerEmail,
        pass: this.appConfig.nodeMailerPassword,
      },
    });

    const info = await transporter.sendMail({
      from: this.appConfig.nodeMailerEmail,
      to: email,
      subject: subject,
      html: message,
    });

    //console.log('Sent email from EmailAdapter: ', info);
    return info;
  }
}
