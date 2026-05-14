import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);
    private client: Twilio.Twilio;
    private fromNumber: string;

    constructor(private readonly config: ConfigService) {
        this.initTwilio();
    }

    // ─── Initialise Twilio Client ────────────────────────────────────────────────

    private initTwilio() {
        const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
        this.fromNumber = this.config.get<string>(
            'TWILIO_WHATSAPP_FROM',
            'whatsapp:+14155238886',
        );

        if (!accountSid || !authToken) {
            this.logger.warn('⚠️  Twilio credentials missing — WhatsApp disabled');
            return;
        }

        this.client = Twilio(accountSid, authToken);
        this.logger.log('✅ Twilio WhatsApp client ready');
    }

    // ─── Core Send Method ────────────────────────────────────────────────────────

    async sendMessage(to: string, body: string): Promise<boolean> {
        if (!this.client) {
            this.logger.warn('Twilio client not initialized');
            return false;
        }

        // Ensure phone is in WhatsApp format
        const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        try {
            const message = await this.client.messages.create({
                from: this.fromNumber,
                to: toFormatted,
                body,
            });

            this.logger.log(`WhatsApp sent → ${toFormatted} | SID: ${message.sid}`);
            return true;
        } catch (error) {
            this.logger.error(`WhatsApp send failed: ${error.message}`);
            return false;
        }
    }

    // ─── Appointment Confirmation (to Patient) ───────────────────────────────────

    async sendAppointmentConfirmation(data: {
        patientName: string;
        patientPhone: string;
        service: string;
        date: string;
        time: string;
        doctorName?: string;
        appointmentId: string;
    }): Promise<boolean> {
        const body = this.buildConfirmationMessage(data);
        return this.sendMessage(data.patientPhone, body);
    }

    // ─── New Booking Alert (to Clinic) ──────────────────────────────────────────

    async sendNewBookingAlert(data: {
        patientName: string;
        patientPhone: string;
        service: string;
        date: string;
        time: string;
        notes?: string;
    }): Promise<boolean> {
        const clinicWhatsApp = this.config.get<string>('CLINIC_WHATSAPP');
        if (!clinicWhatsApp) {
            this.logger.warn('CLINIC_WHATSAPP not configured');
            return false;
        }

        const body = this.buildClinicAlertMessage(data);
        return this.sendMessage(clinicWhatsApp, body);
    }

    // ─── Appointment Reminder ────────────────────────────────────────────────────

    async sendAppointmentReminder(data: {
        patientName: string;
        patientPhone: string;
        service: string;
        date: string;
        time: string;
        doctorName?: string;
    }): Promise<boolean> {
        const body = this.buildReminderMessage(data);
        return this.sendMessage(data.patientPhone, body);
    }

    // ─── Appointment Cancellation ────────────────────────────────────────────────

    async sendCancellationNotification(data: {
        patientName: string;
        patientPhone: string;
        date: string;
        time: string;
        reason?: string;
    }): Promise<boolean> {
        const body = this.buildCancellationMessage(data);
        return this.sendMessage(data.patientPhone, body);
    }

    // ─── Contact Form Reply ──────────────────────────────────────────────────────

    async sendContactAcknowledgement(data: {
        name: string;
        phone: string;
        inquiryId: string;
    }): Promise<boolean> {
        const body = this.buildContactAckMessage(data);
        return this.sendMessage(data.phone, body);
    }

    // ─── Custom / Ad-hoc Message ─────────────────────────────────────────────────

    async sendCustomMessage(
        phone: string,
        message: string,
    ): Promise<boolean> {
        return this.sendMessage(phone, message);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE TEMPLATES
    // ═══════════════════════════════════════════════════════════════════════

    private buildConfirmationMessage(data: any): string {
        return [
            `🦷 *NMDC Dental — Appointment Confirmed*`,
            ``,
            `Dear ${data.patientName}, your appointment is confirmed!`,
            ``,
            `📋 *Details:*`,
            `• Service: ${data.service}`,
            `• Date: ${data.date}`,
            `• Time: ${data.time}`,
            data.doctorName ? `• Doctor: ${data.doctorName}` : '',
            `• Ref: ${data.appointmentId}`,
            ``,
            `⚠️ Please arrive 10 minutes early.`,
            ``,
            `To cancel or reschedule, reply to this message.`,
            ``,
            `_Advanced Maxillofacial & Dental Treatments — 15+ Years of Excellence_`,
        ]
            .filter((line) => line !== undefined)
            .join('\n');
    }

    private buildClinicAlertMessage(data: any): string {
        return [
            `🆕 *New Appointment Booked*`,
            ``,
            `👤 Patient: ${data.patientName}`,
            `📞 Phone: ${data.patientPhone}`,
            `🦷 Service: ${data.service}`,
            `📅 Date: ${data.date}`,
            `🕐 Time: ${data.time}`,
            data.notes ? `📝 Notes: ${data.notes}` : '',
        ]
            .filter(Boolean)
            .join('\n');
    }

    private buildReminderMessage(data: any): string {
        return [
            `⏰ *NMDC Dental — Appointment Reminder*`,
            ``,
            `Dear ${data.patientName},`,
            ``,
            `This is a reminder that you have an appointment *tomorrow*:`,
            ``,
            `• Service: ${data.service}`,
            `• Date: ${data.date}`,
            `• Time: ${data.time}`,
            data.doctorName ? `• Doctor: ${data.doctorName}` : '',
            ``,
            `Please contact us if you need to reschedule.`,
            ``,
            `_NMDC Dental — Your comfort comes first_`,
        ]
            .filter(Boolean)
            .join('\n');
    }

    private buildCancellationMessage(data: any): string {
        return [
            `❌ *NMDC Dental — Appointment Cancelled*`,
            ``,
            `Dear ${data.patientName},`,
            ``,
            `Your appointment on *${data.date}* at *${data.time}* has been cancelled.`,
            data.reason ? `\nReason: ${data.reason}` : '',
            ``,
            `To book a new appointment, visit our website or reply here.`,
            ``,
            `_NMDC Dental_`,
        ]
            .filter(Boolean)
            .join('\n');
    }

    private buildContactAckMessage(data: any): string {
        return [
            `💬 *NMDC Dental — Message Received*`,
            ``,
            `Dear ${data.name},`,
            ``,
            `Thank you for contacting us. We have received your inquiry and will get back to you within 24 hours.`,
            ``,
            `Reference: ${data.inquiryId}`,
            ``,
            `_NMDC Dental — Advanced Dental Care_`,
        ].join('\n');
    }
}