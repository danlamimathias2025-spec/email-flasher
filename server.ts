/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Transaction, TransactionStatus } from "./src/types";

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for base64 logos
app.use(express.json({ limit: "50mb" }));

// File storage configuration for transaction history
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");

// Ensure storage file exists
function initializeStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

initializeStorage();

// Read transactions from file
function getTransactions(): Transaction[] {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed: Transaction[] = JSON.parse(data);
    
    // De-duplicate on-the-fly to heal any malformed or double-pushed records
    const uniqueMap = new Map<string, Transaction>();
    let hasDuplicates = false;
    for (const tx of parsed) {
      if (tx && tx.id) {
        if (uniqueMap.has(tx.id)) {
          hasDuplicates = true;
          // Keep the newer one or merge them; later ones in the file are newer
          uniqueMap.set(tx.id, tx);
        } else {
          uniqueMap.set(tx.id, tx);
        }
      }
    }
    const uniqueList = Array.from(uniqueMap.values());
    if (hasDuplicates) {
      // Auto-heal the file by saving the de-duplicated list
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(uniqueList, null, 2), "utf-8");
      } catch (err) {
        console.error("Failed to auto-heal duplicate transactions in file:", err);
      }
    }
    return uniqueList;
  } catch (err) {
    console.error("Error reading transactions:", err);
    return [];
  }
}

// Write transactions to file
function saveTransactions(transactions: Transaction[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing transactions:", err);
  }
}

// REST API endpoints
app.get("/api/transactions", (req: Request, res: Response) => {
  const list = getTransactions();
  // Sort by date or createdAt descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
});

app.post("/api/transactions", (req: Request, res: Response) => {
  const tx: Transaction = req.body;
  if (!tx.id || !tx.bankName || !tx.amount) {
    res.status(400).json({ error: "Missing required transaction fields" });
    return;
  }
  const list = getTransactions();
  const existingIndex = list.findIndex((t) => t.id === tx.id);
  if (existingIndex !== -1) {
    list[existingIndex] = tx;
  } else {
    list.push(tx);
  }
  saveTransactions(list);
  res.status(201).json(tx);
});

app.delete("/api/transactions", (req: Request, res: Response) => {
  try {
    saveTransactions([]);
    res.json({ success: true, message: "Transaction history cleared successfully." });
  } catch (err: any) {
    console.error("Error clearing transaction history:", err);
    res.status(500).json({ error: "Failed to clear transaction history." });
  }
});

// Helper: Format status badge background/color
function getStatusStyles(status: TransactionStatus) {
  switch (status) {
    case "successful":
      return { bg: "#ecfdf5", text: "#047857", border: "#10b981", label: "Successful" };
    case "pending":
      return { bg: "#fffbeb", text: "#b45309", border: "#f59e0b", label: "Pending" };
    case "failed":
      return { bg: "#fef2f2", text: "#b91c1c", border: "#ef4444", label: "Failed" };
  }
}

// Helper: Unified High-Quality Paper-Texture Receipt Template Generator
function generateModernPaperReceipt(tx: Transaction, isReceiver: boolean): string {
  const formattedDate = new Date(tx.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }) + " " + new Date(tx.date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const formattedSupportLink = tx.supportLink.includes("@") && !tx.supportLink.startsWith("mailto:")
    ? `mailto:${tx.supportLink}`
    : tx.supportLink;

  const displayBankName = tx.bankName.toUpperCase();
  const secureBankName = tx.bankName.replace(/\s+/g, '').toUpperCase();

  const redBoxHtml = (isReceiver && tx.receiver.redBoxMessage)
    ? `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #fce8e6; border-left: 4px solid #dc2626; border-radius: 8px; width: 100%; border-collapse: separate;">
        <tr>
          <td style="padding: 14px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #991b1b; font-weight: 600; line-height: 1.5; text-align: left; vertical-align: middle;">
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: #eab308; vertical-align: middle; margin-right: 8px; display: inline-block;" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2zm-1 15h2v2h-2v-2zm0-8h2v6h-2V9z" />
            </svg>
            <span style="vertical-align: middle;">${tx.receiver.redBoxMessage}</span>
          </td>
        </tr>
      </table>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tx.bankName} Transaction Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f7f6f4; background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22 viewBox=%220 0 4 4%22%3E%3Cpath d=%22M1 3h1v1H1V3zm2-2h1v1H3V1z%22 fill=%22%23e5e3df%22 fill-opacity=%220.4%22/%3E%3C/svg%3E'); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: transparent; padding: 32px 12px;">
        <tr>
          <td align="center" style="vertical-align: top;">
            <table border="0" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; text-align: left; background-color: transparent;">
              
              <!-- 1. TOP HEADER TEXT -->
              <tr>
                <td style="padding: 0 4px 20px 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="font-size: 19px; font-weight: 700; color: #000000; line-height: 1.25; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Payment Notification - ${tx.id}
                  </div>
                  <div style="font-size: 13px; color: #555555; margin-top: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    to me <span style="font-size: 10px; margin-left: 2px; color: #888888; vertical-align: middle;">▼</span>
                  </div>
                </td>
              </tr>

              <!-- 2. LOGO BANNER -->
              <tr>
                <td style="padding-bottom: 24px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0d2149; border-radius: 8px; width: 100%;">
                    <tr>
                      <td align="center" style="padding: 16px 20px; vertical-align: middle; text-align: center;">
                        <table border="0" cellpadding="0" cellspacing="0" style="display: inline-table; margin: 0 auto;">
                          <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                              <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: #4f83f7; display: block;" xmlns="http://www.w3.org/2000/svg">
                                <polygon points="12,2 2,9 22,9" />
                                <rect x="3" y="10" width="18" height="2" />
                                <rect x="5" y="13" width="2" height="7" />
                                <rect x="9" y="13" width="2" height="7" />
                                <rect x="13" y="13" width="2" height="7" />
                                <rect x="17" y="13" width="2" height="7" />
                                <rect x="2" y="21" width="20" height="2" />
                              </svg>
                            </td>
                            <td style="vertical-align: middle; font-family: 'Arial Black', -apple-system, sans-serif; font-size: 26px; font-weight: 900; color: #4f83f7; letter-spacing: 2px; text-transform: uppercase;">
                              ${displayBankName}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 3. TRANSACTION AMOUNT -->
              <tr>
                <td style="padding-bottom: 24px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="font-size: 13px; font-weight: 800; color: #000000; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">
                    TRANSACTION AMOUNT
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: #000000;">
                    ${tx.currency.symbol}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </td>
              </tr>

              <!-- 4. WARNING NOTICE BOX -->
              ${redBoxHtml ? `
              <tr>
                <td>
                  ${redBoxHtml}
                </td>
              </tr>
              ` : ""}

              <!-- 5. TRANSACTION DETAILS SECTION -->
              <tr>
                <td style="padding-bottom: 28px;">
                  <!-- Section Heading -->
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: left; margin-bottom: 14px;">
                    <span style="font-size: 15px; font-weight: 800; color: #0b2545; border-bottom: 2px solid #0b2545; padding-bottom: 4px; display: inline-block;">
                      Transaction Details
                    </span>
                  </div>

                  <!-- Details Card -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; width: 100%; border-collapse: separate;">
                    <tr>
                      <td style="padding: 8px 16px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                          
                          <!-- Receiver Name -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              Receiver Name
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb;">
                              ${tx.receiver.fullName}
                            </td>
                          </tr>

                          <!-- Sender Name -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              Sender Name
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb;">
                              ${tx.sender.fullName}
                            </td>
                          </tr>

                          <!-- Account Number -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              Account Number
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                              ${tx.receiver.accountNumber}
                            </td>
                          </tr>

                          <!-- SWIFT Code -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              SWIFT Code
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                              ${tx.receiver.swiftCode}
                            </td>
                          </tr>

                          <!-- Transaction ID -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              Transaction ID
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb; font-family: monospace;">
                              ${tx.id}
                            </td>
                          </tr>

                          <!-- Date/Time -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left; border-bottom: 1px solid #e5e7eb;">
                              Date/Time
                            </td>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #000000; text-align: right; border-bottom: 1px solid #e5e7eb;">
                              ${formattedDate}
                            </td>
                          </tr>

                          <!-- Status -->
                          <tr>
                            <td style="padding: 11px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b2545; text-align: left;">
                              Status
                            </td>
                            <td style="padding: 11px 0; text-align: right; vertical-align: middle;">
                              <span style="background-color: #16a34a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                                ${tx.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>

                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 6. FOOTER TEXT -->
              <tr>
                <td style="padding-top: 4px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <!-- Secured padlock line -->
                  <div style="font-size: 11.5px; color: #555555; font-weight: 500; display: inline-block; text-align: center; margin-bottom: 6px;">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: #854d0e; vertical-align: middle; margin-right: 4px; display: inline-block;" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                    <span style="vertical-align: middle;">Secured by ${secureBankName} advanced encryption technology.</span>
                  </div>
                  <!-- Support Assistance Line -->
                  <div style="font-size: 11.5px; color: #555555; font-weight: 500; margin-top: 2px;">
                    For assistance, please <a href="${formattedSupportLink}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">contact support</a>.
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Helper: Modern Bank HTML Template Generator
function generateModernBankTemplate(tx: Transaction, isReceiver: boolean): string {
  return generateModernPaperReceipt(tx, isReceiver);
}

// Helper: Minimal Clean HTML Template Generator
function generateMinimalCleanTemplate(tx: Transaction, isReceiver: boolean): string {
  return generateModernPaperReceipt(tx, isReceiver);
}

// Brevo API email dispatcher
async function sendBrevoEmail(
  apiKey: string,
  toEmail: string,
  toName: string,
  bankName: string,
  subject: string,
  htmlContent: string,
  senderEmail?: string
): Promise<boolean> {
  const url = "https://api.brevo.com/v3/smtp/email";
  const body = {
    sender: {
      name: bankName,
      email: senderEmail || process.env.BREVO_SENDER_EMAIL || "transactions@brevo-transfer.com",
    },
    to: [
      {
        email: toEmail,
        name: toName,
      },
    ],
    subject: subject,
    htmlContent: htmlContent,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API Error (${response.status}): ${errorText}`);
  }

  return true;
}

// Resend API email dispatcher
async function sendResendEmail(
  apiKey: string,
  toEmail: string,
  toName: string,
  bankName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const url = "https://api.resend.com/emails";
  const body = {
    from: `${bankName} <onboarding@resend.dev>`,
    to: toEmail,
    subject: subject,
    html: htmlContent,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const sandboxEmail = "danlamimathias2025@gmail.com";
    if (toEmail !== sandboxEmail && (response.status === 403 || errorText.includes("validation_error") || errorText.includes("testing emails"))) {
      console.warn(`Resend sandbox restriction hit for ${toEmail}. Retrying with verified sandbox email: ${sandboxEmail}`);
      const fallbackHtml = `
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 16px; font-family: sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 24px; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 15px; color: #92400e;">⚠️ Resend Sandbox Redirect</p>
          <p style="margin: 0;">You are currently in Resend Sandbox Mode. Emails can only be sent to your registered email address (<strong>${sandboxEmail}</strong>). We have safely routed this alert to you.</p>
          <p style="margin: 8px 0 0 0; font-size: 13px;">Original recipient was: <strong>${toEmail}</strong> (${toName})</p>
        </div>
      ` + htmlContent;

      const retryBody = {
        from: `${bankName} <onboarding@resend.dev>`,
        to: sandboxEmail,
        subject: `[Redirected Box] ${subject}`,
        html: fallbackHtml,
      };

      const retryResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retryBody),
      });

      if (retryResponse.ok) {
        return true;
      } else {
        const retryErrorText = await retryResponse.text();
        throw new Error(`Resend Sandbox Redirect Failed: ${retryErrorText}`);
      }
    }
    throw new Error(`Resend API Error (${response.status}): ${errorText}`);
  }

  return true;
}

// POST endpoint to generate previews for sender and receiver email templates
app.post("/api/preview-email", (req: Request, res: Response) => {
  const { transaction } = req.body;
  if (!transaction) {
    res.status(400).json({ error: "Missing transaction parameters for preview" });
    return;
  }

  try {
    const tx: Transaction = transaction;
    const statusStyles = getStatusStyles(tx.status);
    const senderSubject = `${tx.bankName} [Sender Copy] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;
    const receiverSubject = `${tx.bankName} [Receiver Notification] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;

    const senderHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, false)
      : generateModernBankTemplate(tx, false);

    const receiverHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, true)
      : generateModernBankTemplate(tx, true);

    res.json({
      senderSubject,
      senderHtml,
      receiverSubject,
      receiverHtml,
    });
  } catch (error: any) {
    console.error("Error generating preview:", error);
    res.status(500).json({ error: `Failed to generate email preview: ${error.message || error}` });
  }
});

// POST endpoint to perform the actual transaction mailers
app.post("/api/send-transfer", async (req: Request, res: Response) => {
  const { transaction, sendSender = true, sendReceiver = true, brevoSenderEmail } = req.body;
  if (!transaction) {
    res.status(400).json({ error: "Missing transaction parameters" });
    return;
  }

  // Key Resolution: 
  // Both sender and receiver emails will now use BREVO_API_KEY
  const brevoKey = process.env.BREVO_API_KEY;

  if ((sendSender || sendReceiver) && !brevoKey) {
    res.status(400).json({
      error: "BREVO_API_KEY is not configured. Please add your Brevo API key to the AI Studio Secrets panel or environment variable.",
    });
    return;
  }

  const tx: Transaction = transaction;
  const statusStyles = getStatusStyles(tx.status);
  const senderSubject = `${tx.bankName} [Sender Copy] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;
  const receiverSubject = `${tx.bankName} [Receiver Notification] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;

  const results = {
    sender: false,
    receiver: false,
    error: "",
  };

  try {
    // 1. Generate HTML contents
    const senderHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, false)
      : generateModernBankTemplate(tx, false);

    const receiverHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, true)
      : generateModernBankTemplate(tx, true);

    // 2. Send email to Sender via Brevo API
    if (sendSender && brevoKey) {
      try {
        await sendBrevoEmail(
          brevoKey,
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml,
          brevoSenderEmail
        );
        results.sender = true;
      } catch (err: any) {
        console.error("Error sending email to sender:", err);
        results.error += `Sender email failed: ${err.message || err}. `;
      }
    } else {
      results.sender = false;
    }

    // 3. Send email to Receiver via Brevo API
    if (sendReceiver && brevoKey) {
      try {
        await sendBrevoEmail(
          brevoKey,
          tx.receiver.email,
          tx.receiver.fullName,
          tx.bankName,
          receiverSubject,
          receiverHtml,
          brevoSenderEmail
        );
        results.receiver = true;
      } catch (err: any) {
        console.error("Error sending email to receiver:", err);
        results.error += `Receiver email failed: ${err.message || err}. `;
      }
    } else {
      results.receiver = false;
    }

    // Save final status with transaction record
    const updatedTx: Transaction = {
      ...tx,
      emailsSent: results,
    };

    const list = getTransactions();
    const existingIndex = list.findIndex((t) => t.id === updatedTx.id);
    if (existingIndex !== -1) {
      list[existingIndex] = updatedTx;
    } else {
      list.push(updatedTx);
    }
    saveTransactions(list);

    if (results.error) {
      res.status(400).json({
        error: results.error,
        results: results,
        transaction: updatedTx,
      });
      return;
    }

    res.json({
      success: results.sender || results.receiver,
      results: results,
      transaction: updatedTx,
    });
  } catch (error: any) {
    console.error("General error in sending transfer:", error);
    res.status(500).json({
      error: error.message || "An internal error occurred while processing transfer",
      results: results,
    });
  }
});

// POST endpoint to manually resend emails for an existing transaction
app.post("/api/resend-email", async (req: Request, res: Response) => {
  const { transactionId, transaction, sendSender = true, sendReceiver = true, brevoSenderEmail } = req.body;
  
  let tx = transaction;
  if (!tx) {
    if (!transactionId) {
      res.status(400).json({ error: "Missing transaction parameters" });
      return;
    }
    const list = getTransactions();
    tx = list.find((t) => t.id === transactionId);
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
  }

  const brevoKey = process.env.BREVO_API_KEY;

  if ((sendSender || sendReceiver) && !brevoKey) {
    res.status(400).json({
      error: "BREVO_API_KEY is not configured. Please add your Brevo API key to the Secrets panel to send emails.",
    });
    return;
  }

  const statusStyles = getStatusStyles(tx.status);
  const senderSubject = `[RESENT - Sender Copy] ${tx.bankName} - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;
  const receiverSubject = `[RESENT - Receiver Notification] ${tx.bankName} - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;

  const results = {
    sender: false,
    receiver: false,
    error: "",
  };

  try {
    const senderHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, false)
      : generateModernBankTemplate(tx, false);

    const receiverHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, true)
      : generateModernBankTemplate(tx, true);

    // Send email to Sender via Brevo API
    if (sendSender && brevoKey) {
      try {
        await sendBrevoEmail(
          brevoKey,
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml,
          brevoSenderEmail
        );
        results.sender = true;
      } catch (err: any) {
        console.error("Error sending email to sender:", err);
        results.error += `Sender email failed: ${err.message || err}. `;
      }
    }

    // Send email to Receiver via Brevo API
    if (sendReceiver && brevoKey) {
      try {
        await sendBrevoEmail(
          brevoKey,
          tx.receiver.email,
          tx.receiver.fullName,
          tx.bankName,
          receiverSubject,
          receiverHtml,
          brevoSenderEmail
        );
        results.receiver = true;
      } catch (err: any) {
        console.error("Error sending email to receiver:", err);
        results.error += `Receiver email failed: ${err.message || err}. `;
      }
    }

    const updatedTx: Transaction = {
      ...tx,
      emailsSent: results,
    };

    try {
      const list = getTransactions();
      const txIndex = list.findIndex((t) => t.id === updatedTx.id);
      if (txIndex !== -1) {
        list[txIndex] = updatedTx;
        saveTransactions(list);
      } else {
        list.push(updatedTx);
        saveTransactions(list);
      }
    } catch (e) {
      console.warn("Could not save transaction status to disk:", e);
    }

    if (results.error) {
      res.status(400).json({
        error: results.error,
        results: results,
        transaction: updatedTx,
      });
      return;
    }

    res.json({
      success: results.sender || results.receiver,
      results: results,
      transaction: updatedTx,
    });
  } catch (error: any) {
    console.error("General error in resending email:", error);
    res.status(500).json({
      error: error.message || "An internal error occurred",
      results,
    });
  }
});

// Configure Vite integration for SPA fallback
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
