import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service.js';

/** Ownership rules used by the listing and chat modules. */
@Global()
@Module({
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
