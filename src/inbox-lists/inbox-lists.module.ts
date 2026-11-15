import { Module } from '@nestjs/common';
import { InboxListsController } from './inbox-lists.controller.js';
import { InboxListsService } from './inbox-lists.service.js';

@Module({
  controllers: [InboxListsController],
  providers: [InboxListsService],
  exports: [InboxListsService],
})
export class InboxListsModule {}
