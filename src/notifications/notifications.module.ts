import { Module } from '@nestjs/common';
import { SignupNotifier } from './signup-notifier.service.js';

/** External notifications for events the owner wants to hear about. */
@Module({
  providers: [SignupNotifier],
  exports: [SignupNotifier],
})
export class NotificationsModule {}
