import type { EmailPayload, EmailProvider, ProviderSendResult } from "./notification.types.js";

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string = "noreply@femmeflo.com"
  ) {}

  async sendEmail(payload: EmailPayload): Promise<ProviderSendResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: payload.from || this.defaultFrom,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          providerRef: (responseBody as { id?: string }).id || `resend_${Date.now()}`,
        };
      }

      const isTransient = response.status === 429 || response.status >= 500;
      const errorMessage = (responseBody as { message?: string }).message || `Resend error HTTP ${response.status}`;

      return {
        success: false,
        error: errorMessage,
        isTransient,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Network error sending email: ${message}`,
        isTransient: true,
      };
    }
  }
}

export class MockEmailProvider implements EmailProvider {
  private sentEmails: EmailPayload[] = [];
  private shouldFail = false;
  private failTransient = true;
  private failureMessage = "Simulated email provider failure";

  setSimulateFailure(fail: boolean, isTransient = true, message = "Simulated email provider failure") {
    this.shouldFail = fail;
    this.failTransient = isTransient;
    this.failureMessage = message;
  }

  getSentEmails(): EmailPayload[] {
    return [...this.sentEmails];
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
  }

  async sendEmail(payload: EmailPayload): Promise<ProviderSendResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
        isTransient: this.failTransient,
      };
    }

    this.sentEmails.push({ ...payload });
    return {
      success: true,
      providerRef: `mock_email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

export function createEmailProvider(config: {
  provider?: string;
  apiKey?: string;
  from?: string;
}): EmailProvider {
  if (config.provider === "resend" && config.apiKey) {
    return new ResendEmailProvider(config.apiKey, config.from);
  }
  return new MockEmailProvider();
}
