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

// Normalize Vercel Serverless routing variations (ensure /api/... is matched properly)
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith("/api/")) {
    const knownEndpoints = ["/transactions", "/preview-email", "/send-transfer", "/resend-email"];
    const pathName = req.url.split("?")[0];
    if (knownEndpoints.includes(pathName)) {
      req.url = "/api" + req.url;
    }
  }
  next();
});

// File storage configuration for transaction history - Vercel read-only safe
const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TEMPLATE_FILE = path.join(DATA_DIR, "template.json");

// Ensure storage file exists
function initializeStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
    }
    if (!fs.existsSync(TEMPLATE_FILE)) {
      fs.writeFileSync(TEMPLATE_FILE, JSON.stringify({ html: "" }, null, 2), "utf-8");
    }
    if (!fs.existsSync(USERS_FILE)) {
      const defaultUsers = [
        {
          id: "admin-1",
          email: "mathiasdanlami2025@gmail.com",
          password: "AdminPassword2026",
          role: "admin",
          subscriptionStatus: "approved",
          subscriptionPlan: "1-Month",
          accessCode: "076038",
          receiptImage: null,
          paymentSubmittedAt: null,
          approvedAt: null
        }
      ];
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), "utf-8");
    } else {
      // Migrate existing admin email if the old one is still present
      try {
        const data = fs.readFileSync(USERS_FILE, "utf-8");
        const users = JSON.parse(data);
        let modified = false;
        for (const u of users) {
          if (u.email === "danlamimathias2025@gmail.com") {
            u.email = "mathiasdanlami2025@gmail.com";
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
        }
      } catch (e) {
        console.error("Migration of users failed:", e);
      }
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
app.get(["/api/transactions", "/transactions"], (req: Request, res: Response) => {
  const list = getTransactions();
  // Sort by date or createdAt descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
});

app.post(["/api/transactions", "/transactions"], (req: Request, res: Response) => {
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

app.delete(["/api/transactions", "/transactions"], (req: Request, res: Response) => {
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

// Helper: Crypto Deposit Notification Template
function generateCryptoEmailTemplate(data: { platform: string; status: string; crypto: string; amount: string; supportLink: string; warningMessage?: string; logoCid?: string }): string {
  const { platform, status, crypto, amount, supportLink, warningMessage, logoCid } = data;
  const date = new Date();
  const year = date.getFullYear();
  
  const headerContent = logoCid 
    ? `<img src="cid:${logoCid}" alt="${platform}" style="max-height: 40px; width: auto;" />`
    : `<span style="color: #fcd535; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">${platform}</span>`;

  const supportHref = supportLink.includes('@') ? `mailto:${supportLink}` : supportLink;

  const warningHtml = warningMessage ? `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: #fce8e6; border-left: 4px solid #dc2626; border-radius: 8px; width: 100%; border-collapse: separate;">
      <tr>
        <td style="padding: 14px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #991b1b; font-weight: 600; line-height: 1.5; text-align: left; vertical-align: middle;">
          <span style="font-size: 16px; margin-right: 8px; vertical-align: middle;">⚠️</span>
          <span style="vertical-align: middle;">${warningMessage}</span>
        </td>
      </tr>
    </table>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${platform} Deposit ${status}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background-color: #1e2329; padding: 20px; text-align: center;">
                  ${headerContent}
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h1 style="font-size: 24px; font-weight: 700; color: #1e2329; margin: 0 0 20px 0;">${crypto} Deposit ${status}</h1>
                  
                  <p style="font-size: 16px; color: #474d57; line-height: 1.5; margin: 0 0 20px 0;">
                    Your deposit of ${amount} ${crypto} is now ${status.toLowerCase()} in your <a href="#" style="color: #c99400; text-decoration: none; font-weight: 600;">${platform}</a> account. Log in to check your balance. Read our <a href="#" style="color: #c99400; text-decoration: none; font-weight: 600;">FAQs</a> if you are running into problems.
                  </p>
                  
                  ${warningHtml}
                  
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center" style="background-color: #fcd535; border-radius: 4px;">
                        <a href="#" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 700; color: #1e2329; text-decoration: none;">Visit Your Dashboard</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="font-size: 14px; color: #707a8a; line-height: 1.5; margin: 30px 0 0 0;">
                    <a href="${supportHref}" style="color: #c99400; text-decoration: none; font-weight: 600;">Contact customer support</a> to verify your payment within 24 to 48 hours or your funds will be lost.
                  </p>
                  
                  <p style="font-size: 14px; font-style: italic; color: #707a8a; margin: 20px 0 0 0;">
                    This is an automated message, please do not reply, only reply to customer support.
                  </p>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 30px;">
                  <div style="border-top: 1px solid #eaecef;"></div>
                </td>
              </tr>
              
              <!-- Footer Socials -->
              <tr>
                <td align="center" style="padding: 30px 0;">
                  <p style="font-size: 14px; font-weight: 700; color: #fcd535; margin: 0 0 15px 0;">Stay connected!</p>
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 0 10px;"><img src="https://bin.bnbstatic.com/static/images/common/social/x.png" width="20" height="20" /></td>
                      <td style="padding: 0 10px;"><img src="https://bin.bnbstatic.com/static/images/common/social/telegram.png" width="20" height="20" /></td>
                      <td style="padding: 0 10px;"><img src="https://bin.bnbstatic.com/static/images/common/social/facebook.png" width="20" height="20" /></td>
                      <td style="padding: 0 10px;"><img src="https://bin.bnbstatic.com/static/images/common/social/instagram.png" width="20" height="20" /></td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer Disclaimer -->
              <tr>
                <td style="padding: 0 30px 40px 30px;">
                  <div style="background-color: #fcd535; border-radius: 4px; display: inline-block; padding: 4px 12px; margin-bottom: 15px;">
                    <span style="font-size: 12px; font-weight: 700; color: #1e2329;">Anti-phishing</span>
                  </div>
                  <p style="font-size: 12px; color: #707a8a; margin: 0 0 20px 0;">To stay secure, setup your anti-phishing code <a href="#" style="color: #c99400; text-decoration: none;">here</a></p>
                  
                  <p style="font-size: 11px; color: #707a8a; line-height: 1.4; margin: 0;">
                    <strong>Disclaimer:</strong> Digital asset prices are subject to high market risk and price volatility. The value of your investment may go down or up, and you may not get back the amount invested. You are solely responsible for your investment decisions and <a href="#" style="color: #c99400; text-decoration: none;">${platform}</a> is not liable for any losses you may incur. Past performance is not a reliable predictor of future performance. You should only invest in products you are familiar with and where you understand the risks.
                  </p>
                  <p style="font-size: 11px; color: #707a8a; line-height: 1.4; margin: 15px 0 0 0;">
                    © ${year} <a href="#" style="color: #c99400; text-decoration: none;">${platform}</a>.com, All Rights Reserved.
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

// POST endpoint for Crypto Transfer Email
app.post(["/api/send-crypto-email", "/send-crypto-email"], async (req: Request, res: Response) => {
  const { senderEmail, receiverEmail, crypto, amount, platform, status, supportLink, warningMessage, logoImage } = req.body;
  
  if (!receiverEmail || !crypto || !amount || !platform || !status || !supportLink) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPass = process.env.GMAIL_APP_PASS;

  if (!gmailUser || !gmailAppPass) {
    res.status(400).json({ error: "Gmail SMTP credentials not configured" });
    return;
  }

  try {
    const logoCid = logoImage ? 'platform-logo' : undefined;
    const htmlContent = generateCryptoEmailTemplate({ platform, status, crypto, amount, supportLink, warningMessage, logoCid });
    const subject = `${crypto} Deposit ${status} - ${platform}`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailAppPass,
      },
    });

    const attachments: any[] = [];
    if (logoImage && logoImage.startsWith('data:image/')) {
      const base64Data = logoImage.split(',')[1];
      attachments.push({
        filename: 'logo.png',
        content: Buffer.from(base64Data, 'base64'),
        cid: logoCid
      });
    }

    const mailOptions = {
      from: `"${platform}" <${gmailUser}>`,
      to: receiverEmail,
      subject: subject,
      html: htmlContent,
      replyTo: senderEmail || "internationalbank2026@gmail.com",
      attachments: attachments
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending Crypto email:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

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
                            ${tx.logoUrl ? `
                              <td style="vertical-align: middle; padding-right: 12px;">
                                <img src="${tx.logoUrl}" alt="${tx.bankName} Logo" style="height: 40px; width: auto; max-width: 120px; border-radius: 4px; background: white; padding: 2px;" />
                              </td>
                            ` : `
                              <td style="vertical-align: middle; padding-right: 12px; font-size: 32px; line-height: 1;">
                                🏦
                              </td>
                            `}
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
    const fromAddress = bankName ? `"${bankName}" <${gmailUser}>` : gmailUser;

    // Check for custom template
    let finalHtml = htmlContent;
    try {
      if (fs.existsSync(TEMPLATE_FILE)) {
        const templateData = JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf-8"));
        if (templateData.html && templateData.html.trim() !== "") {
          finalHtml = templateData.html;
          // Basic placeholder replacement (example, needs improvement for real usage)
          finalHtml = finalHtml.replace(/{{BANK_NAME}}/g, bankName);
          if (finalHtml.includes("{{bank_logo_image}}")) {
            const logoPath = path.join(DATA_DIR, "bank_logo.txt");
            if (fs.existsSync(logoPath)) {
              const base64Logo = fs.readFileSync(logoPath, "utf-8");
              finalHtml = finalHtml.replace(/{{bank_logo_image}}/g, `<img src="${base64Logo}" alt="${bankName} Logo" style="height: 40px; width: auto; max-width: 120px; border-radius: 4px; background: white; padding: 2px;" />`);
            } else {
              finalHtml = finalHtml.replace(/{{bank_logo_image}}/g, `<span style="font-size: 24px;">🏦</span>`);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error reading custom template:", e);
    }

    // Extract base64 images from HTML and convert to CID attachments
    const attachments: any[] = [];
    let processedHtml = finalHtml;
    
    // Simple regex to find data:image/base64
    const base64ImageRegex = /src="(data:image\/([a-zA-Z]*);base64,([^"]*))"/g;
    let match;
    let imageCount = 0;

    while ((match = base64ImageRegex.exec(finalHtml)) !== null) {
      const fullMatch = match[0];
      const dataUrl = match[1];
      const extension = match[2];
      const base64Data = match[3];
      const cid = `logo-${imageCount}@transaction.email`;
      
      attachments.push({
        path: dataUrl,
        cid: cid
      });
      
      processedHtml = processedHtml.replace(fullMatch, `src="cid:${cid}"`);
      imageCount++;
    }

    // Create simple text version
    const textContent = `Transaction Notification: ${subject}. Please view this email in an HTML-compatible client.`;

    const mailOptions = {
      from: fromAddress,
      to: `"${toName}" <${toEmail}>`,
      subject: subject,
      text: textContent,
      html: processedHtml,
      attachments: attachments,
      replyTo: displayEmail,
      headers: {
        "X-Mailer": "Nodemailer Secure Dispatcher",
        "X-Priority": "3", // Normal
      },
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
app.post(["/api/preview-email", "/preview-email"], (req: Request, res: Response) => {
  const { transaction } = req.body;
  if (!transaction) {
    res.status(400).json({ error: "Missing transaction parameters for preview" });
    return;
  }

  try {
    const tx: Transaction = transaction;
    const statusStyles = getStatusStyles(tx.status);
    const senderSubject = `${tx.bankName} - Transaction Confirmation (Ref: ${tx.id})`;
    const receiverSubject = `${tx.bankName} - Inward Credit Notification (Ref: ${tx.id})`;

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
app.post(["/api/send-transfer", "/send-transfer"], async (req: Request, res: Response) => {
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

  const list = getTransactions();
  const existingTx = list.find((t) => t.id === tx.id);
  
  if (existingTx && existingTx.emailsSent && (existingTx.emailsSent.sender || existingTx.emailsSent.receiver)) {
    res.status(400).json({ error: "Emails have already been sent for this transaction. Please use the resend endpoint if needed." });
    return;
  }

  const statusStyles = getStatusStyles(tx.status);
  const senderSubject = `${tx.bankName} - Transaction Confirmation (Ref: ${tx.id})`;
  const receiverSubject = `${tx.bankName} - Inward Credit Notification (Ref: ${tx.id})`;

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
app.post(["/api/resend-email", "/resend-email"], async (req: Request, res: Response) => {
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
  const senderSubject = `${tx.bankName} - Transaction Confirmation (Ref: ${tx.id})`;
  const receiverSubject = `${tx.bankName} - Inward Credit Notification (Ref: ${tx.id})`;

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

// --- User Management Helpers & APIs ---
function checkAndExpireUser(user: any): boolean {
  if (!user) return false;
  
  // Give mathiasdanlami2025@gmail.com free access to the app without subscription as the admin
  if (user.email && user.email.trim().toLowerCase() === "mathiasdanlami2025@gmail.com") {
    let changed = false;
    if (user.role !== "admin") {
      user.role = "admin";
      changed = true;
    }
    if (user.subscriptionStatus !== "approved") {
      user.subscriptionStatus = "approved";
      changed = true;
    }
    return changed;
  }
  
  if (user.subscriptionStatus === "approved" && user.approvedAt) {
    const approvedAtMs = new Date(user.approvedAt).getTime();
    let durationMs = 30 * 24 * 60 * 60 * 1000; // 30 days default
    const plan = user.subscriptionPlan || "1-Month";
    if (plan === "6-Months") durationMs = 180 * 24 * 60 * 60 * 1000;
    else if (plan === "1-Year") durationMs = 365 * 24 * 60 * 60 * 1000;
    
    const expiresAt = approvedAtMs + durationMs;
    if (Date.now() > expiresAt) {
      user.subscriptionStatus = "expired";
      return true;
    }
  }
  return false;
}

function getUsers(): any[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    const users = JSON.parse(data);
    let modified = false;
    for (const u of users) {
      if (checkAndExpireUser(u)) {
        modified = true;
      }
    }
    if (modified) {
      try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
      } catch (err) {
        console.error("Error updating expired users in file:", err);
      }
    }
    return users;
  } catch (err) {
    console.error("Error reading users file:", err);
    return [];
  }
}

function saveUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing users file:", err);
  }
}

// Register endpoint
app.post("/api/auth/register", (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    
    const emailNorm = email.trim().toLowerCase();
    const users = getUsers();
    
    if (users.find(u => u.email.toLowerCase() === emailNorm)) {
      res.status(400).json({ error: "User account already exists" });
      return;
    }
    
    const isFirstAdmin = emailNorm === "mathiasdanlami2025@gmail.com";
    
    const newUser = {
      id: "u_" + Math.random().toString(36).substring(2, 11),
      email: email.trim(),
      password: password,
      role: isFirstAdmin ? "admin" : "user",
      subscriptionStatus: isFirstAdmin ? "approved" : "none",
      subscriptionPlan: isFirstAdmin ? "1-Month" : null,
      accessCode: isFirstAdmin ? "076038" : null,
      receiptImage: null,
      paymentSubmittedAt: null,
      approvedAt: null
    };
    
    users.push(newUser);
    saveUsers(users);
    
    res.status(201).json({ 
      success: true, 
      user: { 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role, 
        subscriptionStatus: newUser.subscriptionStatus, 
        accessCode: newUser.accessCode 
      } 
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Login endpoint
app.post("/api/auth/login", (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    
    const emailNorm = email.trim().toLowerCase();
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === emailNorm);
    
    if (!user || user.password !== password) {
      res.status(401).json({ error: "Invalid email or password credentials" });
      return;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        accessCode: user.accessCode,
        paymentSubmittedAt: user.paymentSubmittedAt,
        approvedAt: user.approvedAt
      }
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login user" });
  }
});

// Refresh user status endpoint
app.post("/api/auth/status", (req: Request, res: Response) => {
  console.log("Received status check request for:", req.body);
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    
    const emailNorm = email.trim().toLowerCase();
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === emailNorm);
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        accessCode: user.accessCode,
        paymentSubmittedAt: user.paymentSubmittedAt,
        approvedAt: user.approvedAt
      }
    });
  } catch (err: any) {
    console.error("Status error:", err);
    res.status(500).json({ error: "Failed to fetch user status" });
  }
});

// Get users list (Admin only)
app.get("/api/users", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access: Administrator only" });
      return;
    }
    
    const users = getUsers();
    res.json(users);
  } catch (err: any) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Failed to retrieve user accounts" });
  }
});

// Update user details (Admin only)
app.post("/api/users/update", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access: Administrator only" });
      return;
    }
    
    const { userId, email, password, role, subscriptionStatus, subscriptionPlan } = req.body;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    if (email) users[userIndex].email = email;
    if (password) users[userIndex].password = password;
    if (role) users[userIndex].role = role;
    if (subscriptionStatus) {
      if (subscriptionStatus === "approved" && (users[userIndex].subscriptionStatus !== "approved" || !users[userIndex].approvedAt)) {
        users[userIndex].approvedAt = new Date().toISOString();
      }
      users[userIndex].subscriptionStatus = subscriptionStatus;
    }
    if (subscriptionPlan !== undefined) {
      users[userIndex].subscriptionPlan = subscriptionPlan;
    }
    
    saveUsers(users);
    res.json({ success: true, user: users[userIndex] });
  } catch (err: any) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user account (Admin only)
app.post("/api/users/delete", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access: Administrator only" });
      return;
    }
    
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    
    let users = getUsers();
    const beforeLength = users.length;
    users = users.filter(u => u.id !== userId);
    
    if (users.length === beforeLength) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    saveUsers(users);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Submit payment receipt
app.post("/api/payment/submit", (req: Request, res: Response) => {
  try {
    const { email, receiptImage, subscriptionPlan } = req.body;
    if (!email || !receiptImage || !subscriptionPlan) {
      res.status(400).json({ error: "Email, plan, and transaction receipt image are required" });
      return;
    }
    
    const emailNorm = email.trim().toLowerCase();
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === emailNorm);
    
    if (userIndex === -1) {
      res.status(404).json({ error: "User account not found" });
      return;
    }
    
    users[userIndex].subscriptionStatus = "pending";
    users[userIndex].subscriptionPlan = subscriptionPlan;
    users[userIndex].receiptImage = receiptImage;
    users[userIndex].paymentSubmittedAt = new Date().toISOString();
    
    saveUsers(users);
    res.json({ success: true, status: "pending" });
  } catch (err: any) {
    console.error("Payment submit error:", err);
    res.status(500).json({ error: "Failed to submit transaction receipt" });
  }
});

// Approve user payment (Admin only)
app.post("/api/payment/approve", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access: Administrator only" });
      return;
    }
    
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    const plan = users[userIndex].subscriptionPlan || "1-Month";

    users[userIndex].subscriptionStatus = "approved";
    users[userIndex].approvedAt = new Date().toISOString();
    
    saveUsers(users);
    res.json({ success: true, user: users[userIndex] });
  } catch (err: any) {
    console.error("Approve payment error:", err);
    res.status(500).json({ error: "Failed to approve payment" });
  }
});

// Get email template
app.get("/api/email-template", (req: Request, res: Response) => {
  try {
    const data = fs.readFileSync(TEMPLATE_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve template" });
  }
});

// Save email template
app.post("/api/email-template", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access" });
      return;
    }
    const { html } = req.body;
    let currentTemplate = { html: "", history: [] as string[] };
    if (fs.existsSync(TEMPLATE_FILE)) {
        currentTemplate = JSON.parse(fs.readFileSync(TEMPLATE_FILE, "utf-8"));
    }
    
    // Add old html to history if it exists
    if (currentTemplate.html && currentTemplate.html.trim() !== "") {
        currentTemplate.history.unshift(currentTemplate.html);
        if (currentTemplate.history.length > 3) {
            currentTemplate.history = currentTemplate.history.slice(0, 3);
        }
    }
    
    currentTemplate.html = html;
    fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(currentTemplate, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save template" });
  }
});

// Get email template history
app.get("/api/email-template/history", (req: Request, res: Response) => {
  try {
    const data = fs.readFileSync(TEMPLATE_FILE, "utf-8");
    const template = JSON.parse(data);
    res.json(template.history || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve history" });
  }
});

// Restore email template from history
app.post("/api/email-template/restore", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access" });
      return;
    }
    const { html } = req.body;
    const data = fs.readFileSync(TEMPLATE_FILE, "utf-8");
    const template = JSON.parse(data);
    
    // Move current to history
    template.history.unshift(template.html);
    if (template.history.length > 3) {
        template.history = template.history.slice(0, 3);
    }
    
    template.html = html;
    fs.writeFileSync(TEMPLATE_FILE, JSON.stringify(template, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore template" });
  }
});

// Upload bank logo
app.post("/api/upload-logo", (req: Request, res: Response) => {
  try {
    const { base64 } = req.body;
    fs.writeFileSync(path.join(DATA_DIR, "bank_logo.txt"), base64, "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

// Reset email template
app.post("/api/email-template/reset", (req: Request, res: Response) => {
  try {
    const adminEmail = req.headers["admin-email"] as string;
    if (!adminEmail || adminEmail.trim().toLowerCase() !== "mathiasdanlami2025@gmail.com") {
      res.status(403).json({ error: "Unauthorized access" });
      return;
    }
    fs.writeFileSync(TEMPLATE_FILE, JSON.stringify({ html: "" }, null, 2), "utf-8");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset template" });
  }
});

// Get exchange rates for base
app.get("/api/exchange-rates/:base", async (req: Request, res: Response) => {
  try {
    const { base } = req.params;
    const apiKey = process.env.CURRENCY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`);
    const data = await response.json();
    if (data.result === "success") {
      res.json(data.conversion_rates);
    } else {
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rates" });
  }
});

// Configure Vite integration for SPA fallback
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(vitePkg);
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

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("Unhandled server exception caught:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || String(err),
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
  });
});

if (!process.env.VERCEL) {
  startServer();
}

export default app;
