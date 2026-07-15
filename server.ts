/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { Transaction, TransactionStatus } from "./src/types";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for base64 logos
app.use(express.json({ limit: "50mb" }));

// File storage configuration for transaction history - Vercel read-only safe
const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");

// Ensure storage file exists
function initializeStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (error) {
    console.error("Failed to initialize storage on disk (non-fatal):", error);
  }
}

initializeStorage();

// Read transactions from file
function getTransactions(): Transaction[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
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
            <span style="font-size: 16px; margin-right: 8px; vertical-align: middle;">⚠️</span>
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
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none;">
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
                    Official Receipt
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
                            <td style="vertical-align: middle; padding-right: 12px; font-size: 32px; line-height: 1;">
                              🏦
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
                    <span style="font-size: 13px; margin-right: 4px; vertical-align: middle;">🔒</span>
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

// Unified email dispatcher supporting Gmail SMTP via Nodemailer
async function dispatchEmail(
  toEmail: string,
  toName: string,
  bankName: string,
  subject: string,
  htmlContent: string,
  senderEmail?: string
): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPass = process.env.GMAIL_APP_PASS;

  if (gmailUser && gmailAppPass) {
    console.log(`Dispatching email to ${toEmail} via Gmail SMTP...`);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPass,
      },
    });

    const displayEmail = senderEmail || "internationalbank2026@gmail.com";
    const fromAddress = bankName ? `"${bankName}" <${displayEmail}>` : displayEmail;

    const mailOptions = {
      from: fromAddress,
      to: `"${toName}" <${toEmail}>`,
      subject: subject,
      html: htmlContent,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email successfully sent to ${toEmail}`);
      return true;
    } catch (err: any) {
      console.error("Nodemailer SMTP Error:", err);
      throw new Error(`Gmail SMTP Dispatch Error: ${err.message || err}`);
    }
  }

  throw new Error("Gmail SMTP credentials (GMAIL_USER & GMAIL_APP_PASS) are not configured in environment variables.");
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
  const { transaction, sendSender = true, sendReceiver = true, mailjetSenderEmail, gmailSenderEmail, brevoSenderEmail } = req.body;
  if (!transaction) {
    res.status(400).json({ error: "Missing transaction parameters" });
    return;
  }

  // Key Resolution: 
  // Supports Gmail SMTP (GMAIL_USER & GMAIL_APP_PASS)
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPass = process.env.GMAIL_APP_PASS;

  if ((sendSender || sendReceiver) && (!gmailUser || !gmailAppPass)) {
    res.status(400).json({
      error: "Gmail SMTP credentials are not configured on the server. Please add GMAIL_USER and GMAIL_APP_PASS to your Vercel/environment variables.",
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

  const senderEmailToUse = gmailSenderEmail || mailjetSenderEmail || brevoSenderEmail;

  try {
    // 1. Generate HTML contents
    const senderHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, false)
      : generateModernBankTemplate(tx, false);

    const receiverHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, true)
      : generateModernBankTemplate(tx, true);

    // 2. Send email to Sender
    if (sendSender) {
      try {
        await dispatchEmail(
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml,
          senderEmailToUse
        );
        results.sender = true;
      } catch (err: any) {
        console.error("Error sending email to sender:", err);
        results.error += `Sender email failed: ${err.message || err}. `;
      }
    } else {
      results.sender = false;
    }

    // 3. Send email to Receiver
    if (sendReceiver) {
      try {
        await dispatchEmail(
          tx.receiver.email,
          tx.receiver.fullName,
          tx.bankName,
          receiverSubject,
          receiverHtml,
          senderEmailToUse
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
  const { transactionId, transaction, sendSender = true, sendReceiver = true, mailjetSenderEmail, gmailSenderEmail, brevoSenderEmail } = req.body;
  
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

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPass = process.env.GMAIL_APP_PASS;

  if ((sendSender || sendReceiver) && (!gmailUser || !gmailAppPass)) {
    res.status(400).json({
      error: "Gmail SMTP credentials are not configured on the server. Please add GMAIL_USER and GMAIL_APP_PASS to your Vercel/environment variables.",
    });
    return;
  }

  const statusStyles = getStatusStyles(tx.status);
  const senderSubject = `${tx.bankName} [Sender Copy] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;
  const receiverSubject = `${tx.bankName} [Receiver Notification] - Transaction Alert: ${statusStyles.label} - ${tx.currency.symbol}${tx.amount.toLocaleString()} ${tx.currency.code}`;

  const results = {
    sender: false,
    receiver: false,
    error: "",
  };

  const senderEmailToUse = gmailSenderEmail || mailjetSenderEmail || brevoSenderEmail;

  try {
    const senderHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, false)
      : generateModernBankTemplate(tx, false);

    const receiverHtml = tx.emailTemplate === "minimal_clean"
      ? generateMinimalCleanTemplate(tx, true)
      : generateModernBankTemplate(tx, true);

    // Send email to Sender
    if (sendSender) {
      try {
        await dispatchEmail(
          tx.sender.email,
          tx.sender.fullName,
          tx.bankName,
          senderSubject,
          senderHtml,
          senderEmailToUse
        );
        results.sender = true;
      } catch (err: any) {
        console.error("Error sending email to sender:", err);
        results.error += `Sender email failed: ${err.message || err}. `;
      }
    }

    // Send email to Receiver
    if (sendReceiver) {
      try {
        await dispatchEmail(
          tx.receiver.email,
          tx.receiver.fullName,
          tx.bankName,
          receiverSubject,
          receiverHtml,
          senderEmailToUse
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
    const { createServer: createViteServer } = await import("vite");
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
