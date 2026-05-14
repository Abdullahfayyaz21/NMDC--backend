import { Injectable, Logger } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { WhatsappService } from './whatsapp.service';

export interface AppointmentNotificationData {
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    service: string;
    date: string;
    time: string;
    doctorName?: string;
    notes?: string;
    appointmentId: string;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly gmail: GmailService,
        private readonly whatsapp: WhatsappService,
    ) { }

    // ─── Send all notifications for a new booking ────────────────────────────────

    async notifyNewAppointment(data: AppointmentNotificationData): Promise<{
        emailToPatient: boolean;
        emailToClinic: boolean;
        whatsappToPatient: boolean;
        whatsappToClinic: boolean;
    }> {
        this.logger.log(`Sending new appointment notifications for: ${data.patientName}`);

        const [emailToPatient, emailToClinic, whatsappToPatient, whatsappToClinic] =
            await Promise.allSettled([
                this.gmail.sendAppointmentConfirmation(data),
                this.gmail.sendNewBookingAlert(data),
                this.whatsapp.sendAppointmentConfirmation(data),
                this.whatsapp.sendNewBookingAlert(data),
            ]);

        return {
            emailToPatient: this.extractResult(emailToPatient),
            emailToClinic: this.extractResult(emailToClinic),
            whatsappToPatient: this.extractResult(whatsappToPatient),
            whatsappToClinic: this.extractResult(whatsappToClinic),
        };
    }

    // ─── Send appointment reminder (triggered by cron job) ──────────────────────

    async notifyReminder(data: {
        patientName: string;
        patientEmail: string;
        patientPhone: string;
        service: string;
        date: string;
        time: string;
        doctorName?: string;
        clinicAddress?: string;
    }): Promise<{ email: boolean; whatsapp: boolean }> {
        this.logger.log(`Sending reminder to: ${data.patientName}`);

        const [email, whatsapp] = await Promise.allSettled([
            this.gmail.sendAppointmentReminder(data),
            this.whatsapp.sendAppointmentReminder(data),
        ]);

        return {
            email: this.extractResult(email),
            whatsapp: this.extractResult(whatsapp),
        };
    }

    // ─── Send cancellation notifications ────────────────────────────────────────

    async notifyCancellation(data: {
        patientName: string;
        patientEmail: string;
        patientPhone: string;
        date: string;
        time: string;
        reason?: string;
    }): Promise<{ email: boolean; whatsapp: boolean }> {
        this.logger.log(`Sending cancellation to: ${data.patientName}`);

        const [email, whatsapp] = await Promise.allSettled([
            this.gmail.sendCancellationEmail(data),
            this.whatsapp.sendCancellationNotification(data),
        ]);

        return {
            email: this.extractResult(email),
            whatsapp: this.extractResult(whatsapp),
        };
    }

    // ─── Send contact form acknowledgements ──────────────────────────────────────

    async notifyContactReceived(data: {
        name: string;
        email: string;
        phone?: string;
        message: string;
        inquiryId: string;
    }): Promise<{ email: boolean; whatsapp: boolean }> {
        const results = await Promise.allSettled([
            this.gmail.sendContactAcknowledgement(data),
            data.phone
                ? this.whatsapp.sendContactAcknowledgement({
                    name: data.name,
                    phone: data.phone,
                    inquiryId: data.inquiryId,
                })
                : Promise.resolve(false),
        ]);

        return {
            email: this.extractResult(results[0]),
            whatsapp: this.extractResult(results[1]),
        };
    }

    private extractResult(result: PromiseSettledResult<boolean>): boolean {
        return result.status === 'fulfilled' ? result.value : false;
    }
}