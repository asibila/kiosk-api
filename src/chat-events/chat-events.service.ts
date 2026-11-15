import { Injectable } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

/** A chat message as it is broadcast to connected clients. */
export interface ChatMessagePayload {
  id: number;
  text: string;
  threadId: number;
  userId: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: number | null;
  updatedBy: number | null;
}

/**
 * Events pushed to `/chat-events/stream`. Chat screens use `message.created`
 * to append incoming messages without a page reload.
 */
export type ChatEvent =
  | { type: 'message.created'; message: ChatMessagePayload }
  | { type: 'message.updated'; message: ChatMessagePayload };

@Injectable()
export class ChatEventsService {
  private readonly subject = new Subject<ChatEvent>();

  readonly events$: Observable<ChatEvent> = this.subject.asObservable();

  publish(event: ChatEvent): void {
    this.subject.next(event);
  }
}
