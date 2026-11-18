import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Row fields the notification needs; anything else is ignored. */
export type SignupNotice = {
  id: number;
  name: string;
  email: string;
  createdAt?: Date | string;
};

/**
 * Announces new accounts to an external webhook (Slack, Discord, or any URL).
 *
 * Registration must never fail because a notification failed, so this is
 * fire-and-forget: no webhook configured means no request, and a timeout or a
 * non-2xx answer is only logged. The payload carries both `text` (Slack) and
 * `content` (Discord); each service ignores the key it does not use.
 */
@Injectable()
export class SignupNotifier {
  private readonly logger = new Logger(SignupNotifier.name);

  constructor(private readonly config: ConfigService) {}

  /** Configured webhook URL, or `null`. Read per call so tests can change it. */
  private webhookUrl(): string | null {
    const url = this.config.get<string>('SIGNUP_WEBHOOK_URL')?.trim();
    return url ? url : null;
  }

  /** Build the human-readable message (also used by the tests). */
  message(user: SignupNotice): string {
    const origin = this.config.get<string>('PUBLIC_ORIGIN')?.trim();
    const parts = [
      `New signup: ${user.name} <${user.email}>`,
      `#${user.id}`,
      user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 16).replace('T', ' ') : null,
      origin || null,
    ].filter(Boolean);

    return parts.join(' · ');
  }

  /** Send the notification. Never throws. */
  async notify(user: SignupNotice): Promise<void> {
    const url = this.webhookUrl();
    if (!url) return;

    const text = this.message(user);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(3_000),
      });

      if (!response.ok) {
        this.logger.warn(`Signup webhook answered ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Signup webhook failed: ${message}`);
    }
  }
}
