import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendMailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: any[];
}

@Injectable()
export class GmailService {
    private readonly logger = new Logger(GmailService.name);
    private transporter: Transporter;

    constructor(private readonly config: ConfigService) {
        this.initTransporter();
    }

    // ─── Initialise OAuth2 Transporter ──────────────────────────────────────────

    private initTransporter() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: this.config.get<string>('GMAIL_USER'),
                clientId: this.config.get<string>('GMAIL_CLIENT_ID'),
                clientSecret: this.config.get<string>('GMAIL_CLIENT_SECRET'),
                refreshToken: this.config.get<string>('GMAIL_REFRESH_TOKEN'),
            },
        });

        this.transporter.verify((error) => {
            if (error) {
                this.logger.error(`Gmail transporter error: ${error.message}`);
            } else {
                this.logger.log('✅ Gmail transporter ready');
            }
        });
    }

    // ─── Core Send Method ────────────────────────────────────────────────────────

    async sendMail(options: SendMailOptions): Promise<boolean> {
        try {
            const info = await this.transporter.sendMail({
                from: `"${this.config.get('CLINIC_NAME', 'NMDC Dental')}" <${this.config.get('GMAIL_USER')}>`,
                to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
                attachments: options.attachments,
            });

            this.logger.log(`Email sent → ${options.to} | ID: ${info.messageId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send email: ${error.message}`);
            return false;
        }
    }

    // ─── Appointment Confirmation (to Patient) ───────────────────────────────────

    async sendAppointmentConfirmation(data: {
        patientName: string;
        patientEmail: string;
        service: string;
        date: string;
        time: string;
        doctorName?: string;
        appointmentId: string;
    }): Promise<boolean> {
        const html = this.buildAppointmentConfirmationTemplate(data);
        return this.sendMail({
            to: data.patientEmail,
            subject: `✅ Appointment Confirmed — NMDC Dental | ${data.date}`,
            html,
        });
    }

    // ─── New Booking Alert (to Clinic) ──────────────────────────────────────────

    async sendNewBookingAlert(data: {
        patientName: string;
        patientEmail: string;
        patientPhone: string;
        service: string;
        date: string;
        time: string;
        notes?: string;
        appointmentId: string;
    }): Promise<boolean> {
        const html = this.buildClinicAlertTemplate(data);
        return this.sendMail({
            to: this.config.get<string>('CLINIC_EMAIL'),
            subject: `🦷 New Appointment: ${data.patientName} — ${data.date} at ${data.time}`,
            html,
        });
    }

    // ─── Appointment Reminder (to Patient, sent 24h before) ─────────────────────

    async sendAppointmentReminder(data: {
        patientName: string;
        patientEmail: string;
        service: string;
        date: string;
        time: string;
        doctorName?: string;
        clinicAddress?: string;
    }): Promise<boolean> {
        const html = this.buildReminderTemplate(data);
        return this.sendMail({
            to: data.patientEmail,
            subject: `⏰ Reminder: Your Dental Appointment Tomorrow at ${data.time}`,
            html,
        });
    }

    // ─── Appointment Cancellation ────────────────────────────────────────────────

    async sendCancellationEmail(data: {
        patientName: string;
        patientEmail: string;
        date: string;
        time: string;
        reason?: string;
    }): Promise<boolean> {
        const html = this.buildCancellationTemplate(data);
        return this.sendMail({
            to: data.patientEmail,
            subject: `❌ Appointment Cancelled — NMDC Dental`,
            html,
        });
    }

    // ─── Contact Form Acknowledgement ───────────────────────────────────────────

    async sendContactAcknowledgement(data: {
        name: string;
        email: string;
        message: string;
        inquiryId: string;
    }): Promise<boolean> {
        const html = this.buildContactAckTemplate(data);
        return this.sendMail({
            to: data.email,
            subject: `💬 We received your message — NMDC Dental`,
            html,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EMAIL HTML TEMPLATES
    // ═══════════════════════════════════════════════════════════════════════

    private baseWrapper(content: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>NMDC Dental</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">🦷 NMDC Dental</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Professional Dental Care — 15+ Years of Excellence</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#fff;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:24px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © ${new Date().getFullYear()} NMDC Dental. All rights reserved.<br/>
              Advanced Maxillofacial & Dental Treatments
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }

    private buildAppointmentConfirmationTemplate(data: any): string {
        return this.baseWrapper(`
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Appointment Confirmed! ✅</h2>
      <p style="margin:0 0 28px;color:#64748b;font-size:15px;">Dear <strong>${data.patientName}</strong>, your appointment has been successfully booked.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;display:block;">Service</span>
          <strong style="color:#0f172a;font-size:15px;">${data.service}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;display:block;">Date</span>
          <strong style="color:#0f172a;font-size:15px;">📅 ${data.date}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;display:block;">Time</span>
          <strong style="color:#0f172a;font-size:15px;">🕐 ${data.time}</strong>
        </td></tr>
        ${data.doctorName ? `<tr><td style="padding:8px 0;">
          <span style="color:#94a3b8;font-size:13px;display:block;">Doctor</span>
          <strong style="color:#0f172a;font-size:15px;">👨‍⚕️ ${data.doctorName}</strong>
        </td></tr>` : ''}
      </table>

      <p style="margin:0 0 8px;color:#64748b;font-size:14px;">
        📋 Appointment Reference: <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;">${data.appointmentId}</code>
      </p>

      <div style="margin:28px 0;padding:16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.6;">
          <strong>Before your visit:</strong><br/>
          • Please arrive 10 minutes early<br/>
          • Bring any previous dental X-rays if available<br/>
          • Inform us of any medications you are taking
        </p>
      </div>

      <p style="margin:0;color:#64748b;font-size:14px;">Need to reschedule? Reply to this email or call us directly.</p>
    `);
    }

    private buildClinicAlertTemplate(data: any): string {
        return this.baseWrapper(`
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">New Appointment Booked 🆕</h2>
      <p style="margin:0 0 28px;color:#64748b;font-size:15px;">A new appointment has been scheduled through the website.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:24px;margin-bottom:28px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;">Patient Name</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.patientName}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;">Email</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.patientEmail}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;">Phone</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.patientPhone}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;">Service</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.service}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#94a3b8;font-size:13px;">Date</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.date}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;${data.notes ? 'border-bottom:1px solid #e2e8f0;' : ''}">
          <span style="color:#94a3b8;font-size:13px;">Time</span>
          <strong style="color:#0f172a;font-size:15px;float:right;">${data.time}</strong>
        </td></tr>
        ${data.notes ? `<tr><td style="padding:8px 0;">
          <span style="color:#94a3b8;font-size:13px;display:block;">Patient Notes</span>
          <p style="margin:4px 0 0;color:#0f172a;font-size:14px;">${data.notes}</p>
        </td></tr>` : ''}
      </table>

      <p style="margin:0;color:#94a3b8;font-size:13px;">Reference ID: ${data.appointmentId}</p>
    `);
    }

    private buildReminderTemplate(data: any): string {
        return this.baseWrapper(`
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Appointment Tomorrow! ⏰</h2>
      <p style="margin:0 0 28px;color:#64748b;font-size:15px;">Dear <strong>${data.patientName}</strong>, just a friendly reminder about your appointment.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafeff;border:2px solid #bae6fd;border-radius:12px;padding:24px;margin-bottom:28px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e0f2fe;">
          <span style="color:#0284c7;font-size:13px;display:block;">Service</span>
          <strong style="color:#0f172a;font-size:15px;">${data.service}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e0f2fe;">
          <span style="color:#0284c7;font-size:13px;display:block;">📅 Date</span>
          <strong style="color:#0f172a;font-size:16px;">${data.date}</strong>
        </td></tr>
        <tr><td style="padding:8px 0;${data.doctorName ? 'border-bottom:1px solid #e0f2fe;' : ''}">
          <span style="color:#0284c7;font-size:13px;display:block;">🕐 Time</span>
          <strong style="color:#0f172a;font-size:16px;">${data.time}</strong>
        </td></tr>
        ${data.doctorName ? `<tr><td style="padding:8px 0;">
          <span style="color:#0284c7;font-size:13px;display:block;">👨‍⚕️ Doctor</span>
          <strong style="color:#0f172a;font-size:15px;">${data.doctorName}</strong>
        </td></tr>` : ''}
      </table>

      ${data.clinicAddress ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">📍 ${data.clinicAddress}</p>` : ''}
      <p style="margin:0;color:#64748b;font-size:14px;">See you tomorrow! If you need to cancel or reschedule, please contact us as soon as possible.</p>
    `);
    }

    private buildCancellationTemplate(data: any): string {
        return this.baseWrapper(`
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Appointment Cancelled</h2>
      <p style="margin:0 0 28px;color:#64748b;font-size:15px;">Dear <strong>${data.patientName}</strong>, your appointment has been cancelled.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-radius:12px;padding:24px;margin-bottom:28px;">
        <tr><td style="padding:6px 0;"><span style="color:#94a3b8;font-size:13px;">Date</span> <strong style="color:#0f172a;float:right;">${data.date}</strong></td></tr>
        <tr><td style="padding:6px 0;"><span style="color:#94a3b8;font-size:13px;">Time</span> <strong style="color:#0f172a;float:right;">${data.time}</strong></td></tr>
        ${data.reason ? `<tr><td style="padding:6px 0;"><span style="color:#94a3b8;font-size:13px;">Reason</span><p style="margin:4px 0 0;color:#0f172a;">${data.reason}</p></td></tr>` : ''}
      </table>

      <p style="margin:0;color:#64748b;font-size:14px;">To book a new appointment, visit our website or call us directly.</p>
    `);
    }

    private buildContactAckTemplate(data: any): string {
        return this.baseWrapper(`
      <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Thanks for reaching out! 💬</h2>
      <p style="margin:0 0 28px;color:#64748b;font-size:15px;">Dear <strong>${data.name}</strong>, we have received your message and will get back to you within 24 hours.</p>

      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:28px;">
        <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">Your message:</p>
        <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.7;font-style:italic;">"${data.message}"</p>
      </div>

      <p style="margin:0;color:#64748b;font-size:13px;">Inquiry reference: <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">${data.inquiryId}</code></p>
    `);
    }
}