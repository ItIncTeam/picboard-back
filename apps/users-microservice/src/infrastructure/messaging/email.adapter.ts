import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailAdapter {
  constructor() {}

  async sendEmail(email: string, subject: string, message: string) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      service: 'gmail',
      port: 465,
      secure: true,
      ignoreTLS: true,
      auth: {
        user: 'dina.additional@gmail.com',
        pass: 'dpsy fiuh adlv wpzb',
      },
    });

    const info = await transporter.sendMail({
      from: 'dina.additional@gmail.com',
      to: email,
      subject: subject,
      html: message,
    });

    //console.log('Sent email from EmailAdapter: ', info);
    return info;
  }
}
