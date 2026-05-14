import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailService } from './gmail.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
    imports: [ConfigModule],
    controllers: [NotificationsController],
    providers: [GmailService, WhatsappService, NotificationsService],
    exports: [GmailService, WhatsappService, NotificationsService],
})
export class NotificationsModule { }