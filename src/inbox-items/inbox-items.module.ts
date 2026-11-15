import { Module } from '@nestjs/common';
import { InboxItemsController } from './inbox-items.controller.js';
import { InboxItemsService } from './inbox-items.service.js';

@Module({
  controllers: [InboxItemsController],
  providers: [InboxItemsService],
  exports: [InboxItemsService],
})
export class InboxItemsModule {}
