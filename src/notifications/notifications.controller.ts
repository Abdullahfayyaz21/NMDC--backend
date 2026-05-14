import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsPhoneNumber } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { GmailService } from './gmail.service';
import { WhatsappService } from './whatsapp.service';

// ─── DTOs ────────────────────────────────────────────────────────────────────

class TestEmailDto {
    @IsEmail()
    to: string;

    @IsString()
    @IsOptional()
    subject?: string;
}

class TestWhatsAppDto {
    @IsString()
    to: string; // e.g. +923001234567

    @IsString()
    @IsOptional()
    message?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly gmailService: GmailService,
        private readonly whatsappService: WhatsappService,
    ) { }

    @Post('test/email')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send a test email via Gmail' })
    @ApiResponse({ status: 200, description: 'Test email sent' })
    async testEmail(@Body() dto: TestEmailDto) {
        const sent = await this.gmailService.sendMail({
            to: dto.to,
            subject: dto.subject || '🦷 NMDC Dental — Test Email',
            html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2>✅ Gmail is working!</h2>
          <p>Your NMDC Dental email service is correctly configured.</p>
          <p style="color:#64748b;font-size:13px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
        });

        return {
            success: sent,
            message: sent
                ? 'Test email sent successfully'
                : 'Failed to send test email — check Gmail credentials',
        };
    }

    @Post('test/whatsapp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Send a test WhatsApp message via Twilio' })
    @ApiResponse({ status: 200, description: 'Test WhatsApp message sent' })
    async testWhatsApp(@Body() dto: TestWhatsAppDto) {
        const sent = await this.whatsappService.sendCustomMessage(
            dto.to,
            dto.message ||
            `🦷 *NMDC Dental* — Test Message\n\nYour WhatsApp integration is working correctly!\n\n_Sent: ${new Date().toLocaleString()}_`,
        );

        return {
            success: sent,
            message: sent
                ? 'WhatsApp message sent successfully'
                : 'Failed to send — check Twilio credentials or verify sandbox join',
        };
    }
}