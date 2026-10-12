import type { WhatsAppPayload, WhatsAppProvider, ProviderSendResult } from "./notification.types.js";

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string
  ) {}

  async sendWhatsApp(payload: WhatsAppPayload): Promise<ProviderSendResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const fromFormatted = this.fromNumber.startsWith("whatsapp:") ? this.fromNumber : `whatsapp:${this.fromNumber}`;
      const toFormatted = payload.to.startsWith("whatsapp:") ? payload.to : `whatsapp:${payload.to}`;

      const params = new URLSearchParams({
        From: fromFormatted,
        To: toFormatted,
        Body: payload.message,
      });

      const authHeader = `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          providerRef: (responseBody as { sid?: string }).sid || `twilio_${Date.now()}`,
        };
      }

      const isTransient = response.status === 429 || response.status >= 500;
      const errorMessage = (responseBody as { message?: string }).message || `Twilio error HTTP ${response.status}`;

      return {
        success: false,
        error: errorMessage,
        isTransient,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Network error sending WhatsApp: ${message}`,
        isTransient: true,
      };
    }
  }
}

export class Msg91WhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly authKey: string,
    private readonly integratedNumber?: string
  ) {}

  async sendWhatsApp(payload: WhatsAppPayload): Promise<ProviderSendResult> {
    try {
      const response = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
        method: "POST",
        headers: {
          "authkey": this.authKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrated_number: this.integratedNumber,
          content_type: "text",
          payload: {
            to: payload.to.replace(/^\+/, ""),
            text: payload.message,
          },
        }),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          providerRef: (responseBody as { request_id?: string }).request_id || `msg91_${Date.now()}`,
        };
      }

      const isTransient = response.status === 429 || response.status >= 500;
      const errorMessage = (responseBody as { message?: string }).message || `MSG91 error HTTP ${response.status}`;

      return {
        success: false,
        error: errorMessage,
        isTransient,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Network error sending WhatsApp via MSG91: ${message}`,
        isTransient: true,
      };
    }
  }
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  private sentMessages: WhatsAppPayload[] = [];
  private shouldFail = false;
  private failTransient = true;
  private failureMessage = "Simulated WhatsApp provider failure";

  setSimulateFailure(fail: boolean, isTransient = true, message = "Simulated WhatsApp provider failure") {
    this.shouldFail = fail;
    this.failTransient = isTransient;
    this.failureMessage = message;
  }

  getSentMessages(): WhatsAppPayload[] {
    return [...this.sentMessages];
  }

  clear() {
    this.sentMessages = [];
    this.shouldFail = false;
  }

  async sendWhatsApp(payload: WhatsAppPayload): Promise<ProviderSendResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
        isTransient: this.failTransient,
      };
    }

    this.sentMessages.push({ ...payload });
    return {
      success: true,
      providerRef: `mock_wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}

export function createWhatsAppProvider(config: {
  provider?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  msg91Key?: string;
  msg91Number?: string;
}): WhatsAppProvider {
  if (config.provider === "twilio" && config.twilioSid && config.twilioToken && config.twilioFrom) {
    return new TwilioWhatsAppProvider(config.twilioSid, config.twilioToken, config.twilioFrom);
  }
  if (config.provider === "msg91" && config.msg91Key) {
    return new Msg91WhatsAppProvider(config.msg91Key, config.msg91Number);
  }
  return new MockWhatsAppProvider();
}
