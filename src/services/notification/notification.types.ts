export type DeliveryChannelType = "EMAIL" | "WHATSAPP";
export type DeliveryStatusType = "PENDING" | "SENT" | "FAILED";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface WhatsAppPayload {
  to: string;
  message: string;
}

export interface ProviderSendResult {
  success: boolean;
  providerRef?: string;
  error?: string;
  isTransient?: boolean;
}

export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<ProviderSendResult>;
}

export interface WhatsAppProvider {
  sendWhatsApp(payload: WhatsAppPayload): Promise<ProviderSendResult>;
}

export interface NotificationDispatchOptions {
  recipientId: string;
  kind: string;
  message: string;
  saleId?: string;
  invoiceId?: string;
  email?: string | null;
  phone?: string | null;
  channels?: DeliveryChannelType[];
}
