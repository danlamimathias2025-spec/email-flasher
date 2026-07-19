/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  country: string;
}

export interface SenderInfo {
  fullName: string;
  email: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
}

export interface ReceiverInfo {
  fullName: string;
  email: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
  redBoxMessage?: string; // Receiver-only message in red box
}

export type TransactionStatus = "successful" | "pending" | "failed";
export type EmailTemplateType = "modern_bank" | "minimal_clean";

export interface Transaction {
  id: string;
  bankName: string;
  logoUrl?: string; // custom uploaded or empty
  supportLink: string;
  amount: number;
  currency: Currency;
  date: string;
  status: TransactionStatus;
  description: string;
  note?: string;
  sender: SenderInfo;
  receiver: ReceiverInfo;
  emailTemplate: EmailTemplateType;
  language?: string; // e.g. 'en', 'es', 'fr'
  createdAt: string;
  emailsSent?: {
    sender: boolean;
    receiver: boolean;
    error?: string;
  };
}
