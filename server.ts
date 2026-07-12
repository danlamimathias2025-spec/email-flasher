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

// Helper: Modern Bank HTML Template Generator
function generateModernBankTemplate(tx: Transaction, isReceiver: boolean): string {
  const statusStyles = getStatusStyles(tx.status);
  const logoHtml = tx.logoUrl 
    ? `<img src="${tx.logoUrl}" alt="${tx.bankName} Logo" style="max-height: 50px; max-width: 180px; display: block;" />`
    : `<div style="background-color: #2563eb; color: #ffffff; padding: 10px 18px; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block; font-family: sans-serif; letter-spacing: 0.5px;">🏦 ${tx.bankName}</div>`;

  const redBoxHtml = (isReceiver && tx.receiver.redBoxMessage)
    ? `<div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-family: sans-serif;">
         <h4 style="color: #b91c1c; margin-top: 0; margin-bottom: 6px; font-size: 15px; font-weight: bold;">⚠️ Notification for Receiver</h4>
         <p style="color: #991b1b; margin: 0; font-size: 13px; line-height: 1.5; font-weight: 500;">${tx.receiver.redBoxMessage}</p>
       </div>`
    : "";

  const formattedSupportLink = tx.supportLink.includes("@") && !tx.supportLink.startsWith("mailto:")
    ? `mailto:${tx.supportLink}`
    : tx.supportLink;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tx.bankName} Transaction Receipt</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 20px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
              
              <!-- HEADER -->
              <tr>
                <td style="background-color: #0f172a; padding: 24px; text-align: left; border-bottom: 4px solid #3b82f6;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="vertical-align: middle;">
                        ${logoHtml}
                      </td>
                      <td style="text-align: right; vertical-align: middle;">
                        <span style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; display: block;">Official Receipt</span>
                        <span style="color: #ffffff; font-size: 13px; font-weight: 500; display: block; margin-top: 2px; font-family: monospace;">Ref: ${tx.id.substring(0, 12).toUpperCase()}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- BODY CONTAINER -->
              <tr>
                <td style="padding: 32px 24px;">
                  
                  ${redBoxHtml}

                  <!-- TRANSACTION HEADER -->
                  <div style="text-align: center; margin-bottom: 28px;">
                    <div style="display: inline-block; background-color: ${statusStyles.bg}; border: 1px solid ${statusStyles.border}; color: ${statusStyles.text}; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; letter-spacing: 0.5px; margin-bottom: 12px;">
                      ● ${statusStyles.label}
                    </div>
                    <div style="font-size: 38px; font-weight: 800; color: #1e293b; letter-spacing: -1px; margin-bottom: 4px;">
                      ${tx.currency.symbol}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="font-size: 20px; font-weight: 500; color: #64748b;">${tx.currency.code}</span>
                    </div>
                    <div style="font-size: 13px; color: #64748b; font-weight: 500;">
                      Transaction Date: ${new Date(tx.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </div>
                  </div>

                  <!-- METADATA CARD -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                    <tr>
                      <td style="font-size: 13px; color: #64748b; font-weight: 500; padding: 4px 0;">Description</td>
                      <td style="font-size: 13px; color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${tx.description}</td>
                    </tr>
                    ${tx.note ? `
                    <tr>
                      <td style="font-size: 13px; color: #64748b; font-weight: 500; padding: 4px 0;">Additional Note</td>
                      <td style="font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; padding: 4px 0; font-style: italic;">"${tx.note}"</td>
                    </tr>
                    ` : ""}
                  </table>

                  <!-- SENDER SECTION -->
                  <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-weight: bold;">Sender Details</h3>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Full Name</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">${tx.sender.fullName}</td>
                    </tr>
                    ${isReceiver ? "" : `
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Email Address</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.sender.email}</td>
                    </tr>
                    `}
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Bank Name</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right;">${tx.sender.bankName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Account Number</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.sender.accountNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">SWIFT / BIC Code</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.sender.swiftCode}</td>
                    </tr>
                  </table>

                  <!-- RECEIVER SECTION -->
                  <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-weight: bold;">Beneficiary Details</h3>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 12px;">
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Full Name</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right;">${tx.receiver.fullName}</td>
                    </tr>
                    ${isReceiver ? "" : `
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Email Address</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.receiver.email}</td>
                    </tr>
                    `}
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Bank Name</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right;">${tx.receiver.bankName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Account Number</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.receiver.accountNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #64748b;">SWIFT / BIC Code</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 500; text-align: right; font-family: monospace;">${tx.receiver.swiftCode}</td>
                    </tr>
                  </table>

                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 10px 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                    This is an automated transaction receipt from ${tx.bankName}.
                  </p>
                  <p style="margin: 0; font-size: 12px;">
                    <a href="${formattedSupportLink}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none; padding: 6px 14px; background-color: #eff6ff; border-radius: 6px; display: inline-block;">
                      Contact Support Assistance
                    </a>
                  </p>
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

// Helper: Minimal Clean HTML Template Generator
function generateMinimalCleanTemplate(tx: Transaction, isReceiver: boolean): string {
  const statusStyles = getStatusStyles(tx.status);
  const logoHtml = tx.logoUrl 
    ? `<img src="${tx.logoUrl}" alt="${tx.bankName} Logo" style="max-height: 40px; max-width: 150px; display: block; margin: 0 auto 16px auto;" />`
    : `<div style="font-size: 24px; font-weight: 800; color: #111827; margin-bottom: 8px; letter-spacing: -0.5px; text-align: center; font-family: sans-serif;">${tx.bankName}</div>`;

  const redBoxHtml = (isReceiver && tx.receiver.redBoxMessage)
    ? `<div style="background-color: #ef4444; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: left;">
         <p style="color: #ffffff; margin: 0; font-size: 13px; line-height: 1.5; font-family: sans-serif; font-weight: 600;">⚠️ Receiver Message: ${tx.receiver.redBoxMessage}</p>
       </div>`
    : "";

  const formattedSupportLink = tx.supportLink.includes("@") && !tx.supportLink.startsWith("mailto:")
    ? `mailto:${tx.supportLink}`
    : tx.supportLink;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Notification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #374151;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; padding: 40px 16px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; text-align: center;">
              
              <!-- LOGO / HEADER -->
              <tr>
                <td style="padding-bottom: 32px;">
                  ${logoHtml}
                  <div style="font-size: 12px; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase;">Payment Notification</div>
                </td>
              </tr>

              <!-- RED BOX MESSAGE (if applicable) -->
              ${redBoxHtml ? `
              <tr>
                <td>
                  ${redBoxHtml}
                </td>
              </tr>
              ` : ""}

              <!-- AMOUNT & STATUS -->
              <tr>
                <td style="padding-bottom: 32px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-size: 40px; font-weight: 700; color: #111827; margin-bottom: 8px; letter-spacing: -1px;">
                    ${tx.currency.symbol}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="font-size: 18px; font-weight: 400; color: #6b7280;">${tx.currency.code}</span>
                  </div>
                  <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">
                    Date: ${new Date(tx.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                  <span style="background-color: ${statusStyles.bg}; color: ${statusStyles.text}; border: 1px solid ${statusStyles.border}; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${statusStyles.label}
                  </span>
                </td>
              </tr>

              <!-- DETAILS -->
              <tr>
                <td style="padding-top: 32px; padding-bottom: 32px; text-align: left;">
                  
                  <div style="margin-bottom: 24px;">
                    <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Transfer Description</div>
                    <div style="font-size: 14px; color: #111827; font-weight: 500;">${tx.description}</div>
                    ${tx.note ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px; font-style: italic;">Note: "${tx.note}"</div>` : ""}
                  </div>

                  <div style="margin-bottom: 24px;">
                    <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">From (Sender)</div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.6;">
                      <tr>
                        <td style="color: #6b7280;">Name</td>
                        <td style="text-align: right; color: #111827; font-weight: 500;">${tx.sender.fullName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Bank</td>
                        <td style="text-align: right; color: #111827;">${tx.sender.bankName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Account</td>
                        <td style="text-align: right; color: #111827; font-family: monospace;">${tx.sender.accountNumber}</td>
                      </tr>
                    </table>
                  </div>

                  <div>
                    <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">To (Beneficiary)</div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 1.6;">
                      <tr>
                        <td style="color: #6b7280;">Name</td>
                        <td style="text-align: right; color: #111827; font-weight: 500;">${tx.receiver.fullName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Bank</td>
                        <td style="text-align: right; color: #111827;">${tx.receiver.bankName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Account</td>
                        <td style="text-align: right; color: #111827; font-family: monospace;">${tx.receiver.accountNumber}</td>
                      </tr>
                    </table>
                  </div>

                </td>
              </tr>

              <!-- FOOTER / HELP LINK -->
              <tr>
                <td style="padding-top: 24px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">
                  <p style="margin: 0 0 12px 0;">This notification has been generated securely on behalf of ${tx.bankName}.</p>
                  <a href="${formattedSupportLink}" target="_blank" style="color: #111827; font-weight: 600; text-decoration: underline;">
                    Need assistance or have questions? Contact support
                  </a>
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

// Brevo API email dispatcher
async function sendBrevoEmail(
  apiKey: string,
  toEmail: string,
  toName: string,
  bankName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const url = "https://api.brevo.com/v3/smtp/email";
  const body = {
    sender: {
      name: bankName,
      email: "transactions@brevo-transfer.com",
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

// POST endpoint to perform the actual transaction mailers
app.post("/api/send-transfer", async (req: Request, res: Response) => {
  const { transaction, sendSender = true, sendReceiver = true } = req.body;
  if (!transaction) {
    res.status(400).json({ error: "Missing transaction parameters" });
    return;
  }

  // Key Resolution: 
  // Sender email uses RESEND_API_KEY
  const resendKey = process.env.RESEND_API_KEY;
  // Receiver email uses BREVO_API_KEY
  const brevoKey = process.env.BREVO_API_KEY;

  if (sendSender && !resendKey) {
    res.status(400).json({
      error: "RESEND_API_KEY is not configured. Please add your Resend API key to the AI Studio Secrets panel or environment variable.",
    });
    return;
  }

  if (sendReceiver && !brevoKey) {
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

    // 2. Send email to Sender via Resend API
    if (sendSender && resendKey) {
      try {
        await sendResendEmail(
          resendKey,
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml
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
          receiverHtml
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
  const { transactionId, sendSender = true, sendReceiver = true } = req.body;
  if (!transactionId) {
    res.status(400).json({ error: "Missing transactionId parameter" });
    return;
  }

  const list = getTransactions();
  const txIndex = list.findIndex((t) => t.id === transactionId);
  if (txIndex === -1) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const tx = list[txIndex];
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;

  if (sendSender && !resendKey) {
    res.status(400).json({
      error: "RESEND_API_KEY is not configured. Please add your Resend API key to the Secrets panel to send to Sender.",
    });
    return;
  }

  if (sendReceiver && !brevoKey) {
    res.status(400).json({
      error: "BREVO_API_KEY is not configured. Please add your Brevo API key to send to Receiver.",
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

    // Send email to Sender via Resend API
    if (sendSender && resendKey) {
      try {
        await sendResendEmail(
          resendKey,
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml
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
          receiverHtml
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

    list[txIndex] = updatedTx;
    saveTransactions(list);

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

startServer();
