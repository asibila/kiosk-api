import { Global, Module } from '@nestjs/common';
import { ChatEventsController } from './chat-events.controller.js';
import { ChatEventsService } from './chat-events.service.js';

/**
 * Global so every service that changes a chat can publish events without
 * importing this module (there is exactly one event subject per process).
 */
@Global()
@Module({
  controllers: [ChatEventsController],
  providers: [ChatEventsService],
  exports: [ChatEventsService],
})
export class ChatEventsModule {}
