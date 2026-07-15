/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import { 
  Building, 
  DollarSign, 
  Calendar, 
  FileText, 
  User, 
  ArrowRight, 
  ArrowLeft, 
  Mail, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  Hash,
  RefreshCw,
  X,
  CreditCard,
  Send,
  Eye,
  Check
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Transaction, Currency, TransactionStatus } from "../types";
import { ALL_CURRENCIES } from "../utils/currencies";
import CurrencySelector from "./CurrencySelector";
import { safeFetchJson, addLocalTransaction } from "../utils/api";

interface TransferWizardProps {
  onTransferSuccess: (newTx: Transaction) => void;
  isLocalMode?: boolean;
}

export default function TransferWizard({ onTransferSuccess, isLocalMode = false }: TransferWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Core State
  const [createdTx, setCreatedTx] = useState<Transaction | null>(null);
  const [sendNowLoading, setSendNowLoading] = useState(false);
  const [sendNowResult, setSendNowResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [shouldSendSender, setShouldSendSender] = useState(false);
  const [shouldSendReceiver, setShouldSendReceiver] = useState(false);
  const [gmailSenderEmail, setGmailSenderEmail] = useState(() => {
    return localStorage.getItem("gmail_sender_email") || localStorage.getItem("mailjet_sender_email") || localStorage.getItem("brevo_sender_email") || "internationalbank2026@gmail.com";
  });
  
  // Validation Error State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Step 1: Transaction Setup
  const [bankName, setBankName] = useState("Union Trust Bank");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [supportLink, setSupportLink] = useState("internationalbank2026@gmail.com");
  const [amount, setAmount] = useState<number>(12500);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(ALL_CURRENCIES[0]); // default USD
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<TransactionStatus>("successful");
  const [description, setDescription] = useState("Corporate Invoice Payment");
  const [note, setNote] = useState("Invoice #CN-2026-904");

  // Step 2: Sender Details
  const [senderName, setSenderName] = useState("Sarah Jenkins");
  const [senderEmail, setSenderEmail] = useState("sarah.j@example.com");
  const [senderBankName, setSenderBankName] = useState("Union Trust Bank");
  const [senderAccountNumber, setSenderAccountNumber] = useState("89201948293");
  const [senderSwiftCode, setSenderSwiftCode] = useState("UTBKN2YXXX");

  // Step 3: Receiver Details & Warning Notice
  const [receiverName, setReceiverName] = useState("Marcus Vance");
  const [receiverEmail, setReceiverEmail] = useState("marcus.v@example.com");
  const [receiverBankName, setReceiverBankName] = useState("Standard Apex Capital");
  const [receiverAccountNumber, setReceiverAccountNumber] = useState("1029482910492");
  const [receiverSwiftCode, setReceiverSwiftCode] = useState("APXCH4XXXX");
  const [redBoxMessage, setRedBoxMessage] = useState(
    "CRITICAL TRANSFER DIRECTIVE: Please complete biometric signature verification within 24 hours to secure immediate release."
  );

  // Step 4: Email Preview State
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    senderSubject: string;
    senderHtml: string;
    receiverSubject: string;
    receiverHtml: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"sender" | "receiver">("sender");

  React.useEffect(() => {
    if (currentStep === 4) {
      const fetchPreview = async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
          const tempTransaction: Transaction = {
            id: "TX-PREVIEW-TEMP",
            bankName,
            logoUrl,
            supportLink,
            amount,
            currency: selectedCurrency,
            date: transactionDate,
            status,
            description,
            note,
            sender: {
              fullName: senderName,
              email: senderEmail,
              bankName: senderBankName,
              accountNumber: senderAccountNumber,
              swiftCode: senderSwiftCode,
            },
            receiver: {
              fullName: receiverName,
              email: receiverEmail,
              bankName: receiverBankName,
              accountNumber: receiverAccountNumber,
              swiftCode: receiverSwiftCode,
              redBoxMessage,
            },
            emailTemplate: "modern_bank",
            createdAt: new Date().toISOString(),
          };

          const response = await fetch("/api/preview-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ transaction: tempTransaction }),
          });

          if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error || "Failed to fetch email preview");
          }

          const data = await response.json();
          setPreviewData(data);
        } catch (err: any) {
          console.error("Preview error:", err);
          setPreviewError(err.message || "An error occurred while generating the email preview.");
        } finally {
          setPreviewLoading(false);
        }
      };

      fetchPreview();
    }
  }, [
    currentStep,
    bankName,
    logoUrl,
    supportLink,
    amount,
    selectedCurrency,
    transactionDate,
    status,
    description,
    note,
    senderName,
    senderEmail,
    senderBankName,
    senderAccountNumber,
    senderSwiftCode,
    receiverName,
    receiverEmail,
    receiverBankName,
    receiverAccountNumber,
    receiverSwiftCode,
    redBoxMessage,
  ]);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // File Upload for Custom Logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setLogoUrl("");
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Input Validation Helper with Zod
  const validateStep = (step: number): boolean => {
    setFieldErrors({});
    setStatusMessage(null);

    if (step === 1) {
      const step1Schema = z.object({
        bankName: z.string().trim().min(1, "Bank display name is required"),
        supportLink: z.string().trim()
          .min(1, "Support contact is required")
          .refine(
            (val) => {
              const isEmail = z.string().email().safeParse(val).success;
              const isUrl = z.string().url().safeParse(val).success || val.startsWith("http://") || val.startsWith("https://");
              return isEmail || isUrl;
            },
            { message: "Must be a valid email address or website URL" }
          ),
        selectedCurrency: z.object({
          code: z.string().trim().min(1, "Currency code is required").max(10, "Currency code is too long"),
          symbol: z.string().trim().min(1, "Currency symbol is required"),
          name: z.string().trim().min(1, "Currency name is required"),
        }),
        amount: z.preprocess(
          (val) => (typeof val === "string" ? parseFloat(val) : val),
          z.number({ message: "Amount must be a number" }).positive("Amount must be greater than 0")
        ),
        transactionDate: z.string().trim().min(1, "Transaction date is required"),
        description: z.string().trim().min(1, "Transfer purpose/description is required"),
        note: z.string().optional(),
      });

      const result = step1Schema.safeParse({
        bankName,
        supportLink,
        selectedCurrency,
        amount,
        transactionDate,
        description,
        note,
      });

      if (!result.success) {
        const formattedErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          formattedErrors[path] = issue.message;
        });
        setFieldErrors(formattedErrors);
        return false;
      }
    } else if (step === 2) {
      const step2Schema = z.object({
        senderName: z.string().trim().min(1, "Sender legal full name is required"),
        senderEmail: z.string().trim().email("Invalid sender email address format"),
        senderBankName: z.string().trim().min(1, "Originating bank name is required"),
        senderAccountNumber: z.string().trim().min(4, "Account number must be at least 4 characters"),
        senderSwiftCode: z.string().trim().min(4, "SWIFT BIC code must be at least 4 characters"),
      });

      const result = step2Schema.safeParse({
        senderName,
        senderEmail,
        senderBankName,
        senderAccountNumber,
        senderSwiftCode,
      });

      if (!result.success) {
        const formattedErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          formattedErrors[path] = issue.message;
        });
        setFieldErrors(formattedErrors);
        return false;
      }
    } else if (step === 3) {
      const step3Schema = z.object({
        receiverName: z.string().trim().min(1, "Receiver legal full name is required"),
        receiverEmail: z.string().trim().email("Invalid receiver email address format"),
        receiverBankName: z.string().trim().min(1, "Receiving bank name is required"),
        receiverAccountNumber: z.string().trim().min(4, "Account number must be at least 4 characters"),
        receiverSwiftCode: z.string().trim().min(4, "SWIFT BIC code must be at least 4 characters"),
      });

      const result = step3Schema.safeParse({
        receiverName,
        receiverEmail,
        receiverBankName,
        receiverAccountNumber,
        receiverSwiftCode,
      });

      if (!result.success) {
        const formattedErrors: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          formattedErrors[path] = issue.message;
        });
        setFieldErrors(formattedErrors);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
      setStatusMessage(null);
    } else {
      setStatusMessage({
        type: "error",
        text: "Please resolve all highlighting validation errors before continuing."
      });
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
    setStatusMessage(null);
    setFieldErrors({});
  };

  const handleStepClick = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
      setStatusMessage(null);
      setFieldErrors({});
    } else if (step > currentStep) {
      // Validate all intermediate steps up to 'step'
      let allValid = true;
      for (let s = currentStep; s < step; s++) {
        if (!validateStep(s)) {
          allValid = false;
          break;
        }
      }
      if (allValid) {
        setCurrentStep(step);
        setStatusMessage(null);
      } else {
        setStatusMessage({
          type: "error",
          text: "Please resolve all highlighting validation errors before continuing."
        });
      }
    }
  };

  // Submit Handler: Triggers creation & instant email dispatch in one request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setStatusMessage({
        type: "error",
        text: "Incomplete details. Please review steps 1-3 to ensure all required fields are correct."
      });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    const transactionPayload: Transaction = {
      id: "TX-" + Math.random().toString(36).substring(2, 11).toUpperCase() + "-" + Date.now().toString().slice(-4),
      bankName,
      logoUrl,
      supportLink,
      amount,
      currency: selectedCurrency,
      date: transactionDate,
      status,
      description,
      note,
      sender: {
        fullName: senderName,
        email: senderEmail,
        bankName: senderBankName,
        accountNumber: senderAccountNumber,
        swiftCode: senderSwiftCode
      },
      receiver: {
        fullName: receiverName,
        email: receiverEmail,
        bankName: receiverBankName,
        accountNumber: receiverAccountNumber,
        swiftCode: receiverSwiftCode,
        redBoxMessage
      },
      emailTemplate: "modern_bank",
      createdAt: new Date().toISOString()
    };

    if (isLocalMode) {
      // Local development simulation fallback
      const localPayload: Transaction = {
        ...transactionPayload,
        emailsSent: { sender: shouldSendSender, receiver: shouldSendReceiver }
      };
      addLocalTransaction(localPayload);
      
      const parts: string[] = [];
      if (shouldSendSender) parts.push("Sender Copy");
      if (shouldSendReceiver) parts.push("Beneficiary Copy");
      
      const text = parts.length > 0 
        ? `Success! (Simulated) Transaction saved and emails dispatched to: ${parts.join(" and ")}.`
        : "Success! (Simulated) Transaction created and saved to browser cache (no emails sent).";

      setStatusMessage({
        type: "success",
        text
      });
      toast.success(parts.length > 0 ? `Simulation: Saved and dispatched ${parts.join(" & ")}!` : "Simulation: Transaction saved!");
      onTransferSuccess(localPayload);
      setCreatedTx(localPayload);
      setIsSending(false);
      return;
    }

    try {
      // Send transaction with instant dispatch flags set to our toggle states
      const result = await safeFetchJson<{
        success: boolean;
        results?: { sender: boolean; receiver: boolean; error?: string };
        transaction?: Transaction;
      }>("/api/send-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: transactionPayload,
          sendSender: shouldSendSender,
          sendReceiver: shouldSendReceiver,
          gmailSenderEmail
        }),
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const parts: string[] = [];
      if (shouldSendSender) parts.push("Sender Copy");
      if (shouldSendReceiver) parts.push("Beneficiary Copy");

      const successText = parts.length > 0
        ? `Transaction completed! Secure receipts have been sent to: ${parts.join(" and ")}.`
        : "Transaction created and saved successfully! No email alerts have been dispatched yet.";

      setStatusMessage({
        type: "success",
        text: successText
      });
      toast.success(parts.length > 0 ? `Receipt email(s) sent successfully!` : "Transaction saved successfully!");

      const returnedTx = result.data?.transaction || {
        ...transactionPayload,
        emailsSent: result.data?.results || { sender: shouldSendSender, receiver: shouldSendReceiver }
      };
      
      onTransferSuccess(returnedTx);
      setCreatedTx(returnedTx);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "An error occurred while creating and dispatching the transaction.";
      setStatusMessage({
        type: "error",
        text: errMsg
      });
      toast.error(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  // Resend Handler: Invokes stateless endpoint passing full payload
  const handleResend = async (sendSender: boolean, sendReceiver: boolean) => {
    if (!createdTx) return;
    setSendNowLoading(true);
    setSendNowResult(null);

    if (isLocalMode) {
      const updatedLocal = {
        ...createdTx,
        emailsSent: {
          sender: sendSender ? true : !!createdTx.emailsSent?.sender,
          receiver: sendReceiver ? true : !!createdTx.emailsSent?.receiver
        }
      };
      setCreatedTx(updatedLocal);
      onTransferSuccess(updatedLocal);
      
      const parts: string[] = [];
      if (sendSender) parts.push("Sender Copy");
      if (sendReceiver) parts.push("Beneficiary Copy");

      setSendNowResult({
        type: "success",
        text: `Success! (Simulated) Dispatched secure email alerts: ${parts.join(" and ")}.`
      });
      toast.success(`Simulation: Dispatched ${parts.join(" & ")}!`);
      setSendNowLoading(false);
      return;
    }

    try {
      const updatedTxPayload = {
        ...createdTx,
        emailsSent: {
          sender: sendSender ? true : !!createdTx.emailsSent?.sender,
          receiver: sendReceiver ? true : !!createdTx.emailsSent?.receiver
        }
      };

       const result = await safeFetchJson<{ success: boolean; results?: { sender: boolean; receiver: boolean }; transaction?: Transaction }>("/api/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: createdTx.id,
          transaction: updatedTxPayload, // Stateless payload for robust operations
          sendSender,
          sendReceiver,
          gmailSenderEmail
        })
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const parts: string[] = [];
      if (sendSender) parts.push("Sender");
      if (sendReceiver) parts.push("Beneficiary");

      setSendNowResult({
        type: "success",
        text: `Success! Receipt dispatch complete for: ${parts.join(" and ")}.`
      });
      toast.success("Receipt emails dispatched successfully!");

      const returnedTx = result.data?.transaction || updatedTxPayload;
      
      onTransferSuccess(returnedTx);
      setCreatedTx(returnedTx);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "Failed to dispatch emails. Please check your Gmail SMTP configuration.";
      setSendNowResult({
        type: "error",
        text: errMsg
      });
      toast.error(errMsg);
    } finally {
      setSendNowLoading(false);
    }
  };

  const resetWizard = () => {
    setCreatedTx(null);
    setCurrentStep(1);
    setAmount(12500);
    setNote("Invoice #CN-2026-904");
    setStatusMessage(null);
    setSendNowResult(null);
    setShouldSendSender(false);
    setShouldSendReceiver(false);
  };

  // SUCCESS SCREEN
  if (createdTx) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full animate-fade-in" id="success-view">
        <div className="bg-slate-900 px-6 py-8 text-center border-b border-slate-800 text-white shrink-0 overflow-hidden relative">
          {/* Subtle animated background grid/glow */}
          <motion.div 
            className="absolute -inset-10 bg-emerald-500/5 rounded-full filter blur-3xl"
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          <div className="relative mx-auto w-20 h-20 flex items-center justify-center mb-4">
            {/* Pulsing ripple rings */}
            <motion.div
              className="absolute inset-0 bg-emerald-500/15 rounded-full"
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 bg-emerald-500/10 rounded-full"
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 2.3, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.6 }}
            />
            
            {/* Exploding success particles */}
            {[...Array(8)].map((_, i) => {
              const angle = (i * 360) / 8;
              const radians = (angle * Math.PI) / 180;
              const x = Math.cos(radians) * 44;
              const y = Math.sin(radians) * 44;
              return (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{ x, y, scale: [0, 1.25, 0], opacity: [1, 1, 0] }}
                  transition={{
                    duration: 0.9,
                    ease: "easeOut",
                    delay: 0.2,
                  }}
                />
              );
            })}

            {/* Core Check Icon with spring pop-in */}
            <motion.div 
              className="relative w-14 h-14 bg-emerald-500 border border-emerald-400 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 z-10"
              initial={{ scale: 0, rotate: -75 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 280, 
                damping: 18,
                delay: 0.05
              }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.2 }}
              >
                <CheckCircle className="h-7 w-7 stroke-[2.5]" />
              </motion.div>
            </motion.div>
          </div>

          <motion.h2 
            className="text-xl font-bold tracking-tight text-white uppercase relative z-10"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            TRANSFER PROCESSED
          </motion.h2>
          
          <motion.p 
            className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black relative z-10"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            Transaction Code: {createdTx.id}
          </motion.p>
        </div>

        <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col justify-between overflow-y-auto">
          <motion.div 
            className="space-y-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3 text-xs text-slate-700">
              <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[10px] border-b border-slate-200 pb-2">
                Secure Transfer Receipt Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2.5">
                <span className="text-slate-500 font-medium">Bank Institution:</span>
                <span className="font-bold text-slate-950 text-right">{createdTx.bankName}</span>

                <span className="text-slate-500 font-medium">Value Amount:</span>
                <span className="font-extrabold text-blue-700 text-right">
                  {createdTx.currency.symbol}{createdTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {createdTx.currency.code}
                </span>

                <span className="text-slate-500 font-medium">From Originator (Sender):</span>
                <span className="font-semibold text-slate-950 text-right">{createdTx.sender.fullName}</span>
                
                <span className="text-slate-400 pl-4">Sender Email:</span>
                <span className="font-mono text-slate-600 text-right text-[11px] truncate">{createdTx.sender.email}</span>

                <span className="text-slate-400 pl-4">Sender Copy Status:</span>
                <span className="text-right">
                  {createdTx.emailsSent?.sender ? (
                    <span className="text-emerald-700 font-bold uppercase text-[9px] tracking-wider bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">Sent</span>
                  ) : (
                    <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider bg-slate-100 border border-slate-200/40 px-2 py-0.5 rounded">Not Sent</span>
                  )}
                </span>

                <span className="text-slate-500 font-medium">To Beneficiary (Receiver):</span>
                <span className="font-semibold text-slate-950 text-right">{createdTx.receiver.fullName}</span>
                
                <span className="text-slate-400 pl-4">Beneficiary Email:</span>
                <span className="font-mono text-slate-600 text-right text-[11px] truncate">{createdTx.receiver.email}</span>

                <span className="text-slate-400 pl-4">Beneficiary Status:</span>
                <span className="text-right">
                  {createdTx.emailsSent?.receiver ? (
                    <span className="text-emerald-700 font-bold uppercase text-[9px] tracking-wider bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">Sent</span>
                  ) : (
                    <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider bg-slate-100 border border-slate-200/40 px-2 py-0.5 rounded">Not Sent</span>
                  )}
                </span>

                <span className="text-slate-500 font-medium">Support Contact Address:</span>
                <span className="font-semibold text-slate-800 text-right">{createdTx.supportLink}</span>
              </div>
            </div>

            {sendNowResult && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs font-semibold ${
                sendNowResult.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}>
                {sendNowResult.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <p className="leading-relaxed">{sendNowResult.text}</p>
              </div>
            )}
          </motion.div>

          <div className="space-y-3.5 pt-6 border-t border-slate-150">
            {/* EMAIL DISPATCH CONTROLS */}
            <div className="text-left space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white inline-block px-1">
                📧 Manual Email Dispatch Controls
              </h4>

              {/* Gmail Sender Email info & input on success screen too */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-left">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  Gmail Sender Email (From / Alias)
                </label>
                <input
                  type="email"
                  value={gmailSenderEmail}
                  onChange={(e) => {
                    setGmailSenderEmail(e.target.value);
                    localStorage.setItem("gmail_sender_email", e.target.value);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 bg-white outline-none"
                  placeholder="user@gmail.com"
                />
                <p className="text-[9px] text-slate-400 leading-normal font-medium">
                  Ideally same as GMAIL_USER or a configured Google Send Mail As alias.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                {/* Dispatch to Sender */}
                <button
                  type="button"
                  disabled={sendNowLoading}
                  onClick={() => handleResend(true, false)}
                  className="flex items-center justify-center gap-2 px-3.5 py-3 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/10 disabled:bg-slate-50 text-slate-700 disabled:text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                  {createdTx.emailsSent?.sender ? "Re-send to Sender" : "Dispatch to Sender"}
                </button>

                {/* Dispatch to Receiver */}
                <button
                  type="button"
                  disabled={sendNowLoading}
                  onClick={() => handleResend(false, true)}
                  className="flex items-center justify-center gap-2 px-3.5 py-3 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/10 disabled:bg-slate-50 text-slate-700 disabled:text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                  {createdTx.emailsSent?.receiver ? "Re-send to Receiver" : "Dispatch to Beneficiary"}
                </button>
              </div>

              {/* Joint Dispatch */}
              <button
                type="button"
                disabled={sendNowLoading}
                onClick={() => handleResend(true, true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-950 disabled:bg-slate-400 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md cursor-pointer"
              >
                {sendNowLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    DISPATCHING SECURE EMAILS...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Dispatch To Both Parties
                  </>
                )}
              </button>
            </div>

            {/* CREATE ANOTHER TRANSFER */}
            <button
              type="button"
              onClick={resetWizard}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
            >
              PROCESS NEW TRANSFER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full" id="transfer-wizard">
      {/* Wizard Step Indicator Header */}
      <div className="bg-gradient-to-b from-[#0a192f] to-[#0f213a] px-6 py-6 border-b border-slate-800 text-white relative">
        {/* Subtle decorative grid lines overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:14px_24px]" />
        
        <div className="mb-4 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-950/80 border border-blue-500/20 text-blue-400 rounded-full text-[8px] font-bold uppercase tracking-widest mb-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SECURE LEDGER DISPATCH CHANNEL ACTIVE
          </div>
          <h2 className="text-base font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Building className="h-4.5 w-4.5 text-blue-400 stroke-[2]" />
            SECURE RECEIPT & NOTIFICATION GATE
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">
            Institutional Transfer & Real-time Dispatch
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-between mt-6 max-w-sm mx-auto relative z-10">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                className="flex flex-col items-center focus:outline-none group cursor-pointer"
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-[11px] transition-all duration-300 ${
                    currentStep === step
                      ? "bg-blue-600 text-white ring-4 ring-blue-500/25 font-black shadow-lg shadow-blue-900/40"
                      : currentStep > step
                      ? "bg-emerald-600 text-white font-black group-hover:bg-emerald-500"
                      : "bg-slate-900/90 text-slate-500 border border-slate-800 group-hover:border-slate-700"
                  }`}
                >
                  {currentStep > step ? <Check className="h-4 w-4 stroke-[3]" /> : step}
                </div>
                <span className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest transition group-hover:text-slate-200">
                  {step === 1 ? "Setup" : step === 2 ? "Sender" : step === 3 ? "Receiver" : "Review"}
                </span>
              </button>
              {step < 4 && (
                <div
                  className={`h-[2px] flex-1 mx-2 transition-all duration-500 ${
                    currentStep > step ? "bg-emerald-600" : "bg-slate-800"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-6 flex flex-col justify-between">
        {statusMessage && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-semibold leading-relaxed">{statusMessage.text}</p>
          </div>
        )}

        {/* STEP 1: TRANSACTION PARAMETERS */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in bg-white">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Step 1: Transaction Setup
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Bank Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Union Trust Bank"
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    if (fieldErrors.bankName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.bankName;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.bankName
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.bankName && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.bankName}
                  </p>
                )}
              </div>

              {/* Support Contact */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Support Link / Email *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. danlamimathias2025@gmail.com"
                  value={supportLink}
                  onChange={(e) => {
                    setSupportLink(e.target.value);
                    if (fieldErrors.supportLink) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.supportLink;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.supportLink
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.supportLink && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.supportLink}
                  </p>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Bank Logo Icon (Optional)
              </label>
              <div className="border border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center space-x-3">
                  {logoUrl ? (
                    <div className="relative">
                      <img src={logoUrl} alt="Logo preview" className="h-10 w-24 object-contain rounded bg-white border p-1" />
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                      <Building className="h-5 w-5" />
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-800">
                      {logoUrl ? "Custom Logo Uploaded" : "Upload JPEG/PNG file"}
                    </p>
                    <p className="text-[10px] text-slate-400">Automatic fit on receipt template</p>
                  </div>
                </div>
                <div>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm"
                  >
                    Upload File
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Currency Selector */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Currency Code *
                </label>
                <CurrencySelector
                  selectedCurrency={selectedCurrency}
                  onSelectCurrency={setSelectedCurrency}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Transfer Amount *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-xs font-mono">{selectedCurrency.symbol}</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(parseFloat(e.target.value) || 0);
                      if (fieldErrors.amount) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.amount;
                          return next;
                        });
                      }
                    }}
                    className={`w-full pl-8 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 outline-none transition bg-slate-50/50 font-mono ${
                      fieldErrors.amount
                        ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                        : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                    }`}
                  />
                </div>
                {fieldErrors.amount && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.amount}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transaction Date */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Transaction Date *
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => {
                    setTransactionDate(e.target.value);
                    if (fieldErrors.transactionDate) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.transactionDate;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.transactionDate
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.transactionDate && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.transactionDate}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Transaction Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition bg-slate-50/50 font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="successful">SUCCESSFUL</option>
                  <option value="pending">PENDING</option>
                  <option value="failed">FAILED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Transfer Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate Invoice Payment"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.description;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.description
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.description && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.description}
                  </p>
                )}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Memo / Note Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #CN-2026-904"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition bg-slate-50/50"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SENDER DETAILS */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Step 2: Originator Identity
              </h3>
              <span className="text-[9px] font-black text-blue-700 bg-blue-50 py-1 px-2.5 rounded uppercase tracking-wider">
                Sender Details
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Legal Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={senderName}
                  onChange={(e) => {
                    setSenderName(e.target.value);
                    if (fieldErrors.senderName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.senderName;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.senderName
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.senderName && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.senderName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.j@example.com"
                  value={senderEmail}
                  onChange={(e) => {
                    setSenderEmail(e.target.value);
                    if (fieldErrors.senderEmail) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.senderEmail;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.senderEmail
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.senderEmail && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.senderEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Bank Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Holding Bank Institution Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Union Trust Bank"
                value={senderBankName}
                onChange={(e) => {
                  setSenderBankName(e.target.value);
                  if (fieldErrors.senderBankName) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.senderBankName;
                      return next;
                    });
                  }
                }}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                  fieldErrors.senderBankName
                    ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                    : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                }`}
              />
              {fieldErrors.senderBankName && (
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                  {fieldErrors.senderBankName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Number */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Account Number / IBAN *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 89201948293"
                  value={senderAccountNumber}
                  onChange={(e) => {
                    setSenderAccountNumber(e.target.value);
                    if (fieldErrors.senderAccountNumber) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.senderAccountNumber;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 font-mono ${
                    fieldErrors.senderAccountNumber
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.senderAccountNumber && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.senderAccountNumber}
                  </p>
                )}
              </div>

              {/* SWIFT Code */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  SWIFT BIC Routing Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTBKN2YXXX"
                  value={senderSwiftCode}
                  onChange={(e) => {
                    setSenderSwiftCode(e.target.value.toUpperCase());
                    if (fieldErrors.senderSwiftCode) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.senderSwiftCode;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 font-mono ${
                    fieldErrors.senderSwiftCode
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.senderSwiftCode && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.senderSwiftCode}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RECEIVER DETAILS & WARNING BANNER */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Step 3: Beneficiary Identity
              </h3>
              <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 py-1 px-2.5 rounded uppercase tracking-wider">
                Receiver Details
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Legal Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={receiverName}
                  onChange={(e) => {
                    setReceiverName(e.target.value);
                    if (fieldErrors.receiverName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.receiverName;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.receiverName
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.receiverName && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.receiverName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. marcus.v@example.com"
                  value={receiverEmail}
                  onChange={(e) => {
                    setReceiverEmail(e.target.value);
                    if (fieldErrors.receiverEmail) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.receiverEmail;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                    fieldErrors.receiverEmail
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.receiverEmail && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.receiverEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Bank Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Receiving Bank Institution Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Standard Apex Capital"
                value={receiverBankName}
                onChange={(e) => {
                  setReceiverBankName(e.target.value);
                  if (fieldErrors.receiverBankName) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.receiverBankName;
                      return next;
                    });
                  }
                }}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 ${
                  fieldErrors.receiverBankName
                    ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                    : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                }`}
              />
              {fieldErrors.receiverBankName && (
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                  {fieldErrors.receiverBankName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Number */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Account Number / IBAN *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1029482910492"
                  value={receiverAccountNumber}
                  onChange={(e) => {
                    setReceiverAccountNumber(e.target.value);
                    if (fieldErrors.receiverAccountNumber) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.receiverAccountNumber;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 font-mono ${
                    fieldErrors.receiverAccountNumber
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.receiverAccountNumber && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.receiverAccountNumber}
                  </p>
                )}
              </div>

              {/* SWIFT Code */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  SWIFT BIC Routing Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. APXCH4XXXX"
                  value={receiverSwiftCode}
                  onChange={(e) => {
                    setReceiverSwiftCode(e.target.value.toUpperCase());
                    if (fieldErrors.receiverSwiftCode) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.receiverSwiftCode;
                        return next;
                      });
                    }
                  }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 outline-none transition bg-slate-50/50 font-mono ${
                    fieldErrors.receiverSwiftCode
                      ? "border-rose-500 focus:ring-rose-500/15 focus:border-rose-500"
                      : "border-slate-200 focus:ring-blue-500/10 focus:border-blue-500"
                  }`}
                />
                {fieldErrors.receiverSwiftCode && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-1">
                    {fieldErrors.receiverSwiftCode}
                  </p>
                )}
              </div>
            </div>

            {/* Red warning box text area */}
            <div className="bg-red-50/60 border border-red-100 rounded-xl p-4 mt-2">
              <label className="block text-[10px] font-black text-red-700 uppercase tracking-wider mb-2">
                ⚠️ Receiver's Alert Notice Message
              </label>
              <textarea
                value={redBoxMessage}
                onChange={(e) => setRedBoxMessage(e.target.value)}
                rows={3}
                placeholder="Leave blank if no caution banner is required..."
                className="w-full border border-red-200/60 rounded-xl p-3 text-xs text-red-900 bg-white focus:ring-2 focus:ring-red-500/10 focus:border-red-400 outline-none resize-none font-medium leading-relaxed"
              />
              <p className="text-[9px] text-red-500/70 mt-1.5 font-bold uppercase tracking-wider">
                * Note: Displays in a red highlight block ONLY on the Beneficiary copy of the email.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: EMAIL PREVIEWS */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in bg-white flex flex-col flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">
                  Step 4: Dispatch Verification & Preview
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Review the automatically compiled notification receipt copies.
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewTab("sender")}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    previewTab === "sender"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sender Copy
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("receiver")}
                  className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                    previewTab === "receiver"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Beneficiary Copy
                </button>
              </div>
            </div>

            {/* Quick Edit Receiver Info Accordion */}
            <div className="border border-slate-200/85 rounded-xl overflow-hidden bg-slate-50/40">
              <button
                type="button"
                onClick={() => setIsQuickEditOpen(!isQuickEditOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100/50 hover:bg-slate-100 text-left transition"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Quick Edit Beneficiary Details
                  </span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                  {isQuickEditOpen ? "Hide" : "Edit Info"}
                </span>
              </button>

              {isQuickEditOpen && (
                <div className="p-4 border-t border-slate-200 bg-white space-y-3.5 animate-fade-in text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Legal Name */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Legal Full Name *
                      </label>
                      <input
                        type="text"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 font-semibold"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Registered Email Address *
                      </label>
                      <input
                        type="email"
                        value={receiverEmail}
                        onChange={(e) => setReceiverEmail(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Bank Name */}
                    <div className="space-y-1 sm:col-span-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Receiving Bank *
                      </label>
                      <input
                        type="text"
                        value={receiverBankName}
                        onChange={(e) => setReceiverBankName(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 font-semibold"
                      />
                    </div>

                    {/* Account Number */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        Account / IBAN *
                      </label>
                      <input
                        type="text"
                        value={receiverAccountNumber}
                        onChange={(e) => setReceiverAccountNumber(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 font-mono font-semibold"
                      />
                    </div>

                    {/* SWIFT Code */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        SWIFT BIC *
                      </label>
                      <input
                        type="text"
                        value={receiverSwiftCode}
                        onChange={(e) => setReceiverSwiftCode(e.target.value.toUpperCase())}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  {/* Red message */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      Receiver Alert Notice Message (Optional)
                    </label>
                    <textarea
                      value={redBoxMessage}
                      onChange={(e) => setRedBoxMessage(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 resize-none font-medium leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Email Dispatch Control Card */}
            <div className="border border-slate-250 rounded-xl p-4 bg-slate-50/50 space-y-3.5 text-left border-dashed">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-800">
                  <Mail className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                    Instant Email Dispatch Settings
                  </span>
                </div>
              </div>
              
              {/* Custom Gmail Sender Email input */}
              <div className="space-y-1.5 bg-white p-3 border border-slate-200 rounded-xl">
                <label className="block text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                  Gmail Sender Email (From / Alias)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@gmail.com"
                  value={gmailSenderEmail}
                  onChange={(e) => {
                    setGmailSenderEmail(e.target.value);
                    localStorage.setItem("gmail_sender_email", e.target.value);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                />
                <p className="text-[9px] text-slate-400 font-medium leading-normal">
                  ⚠️ <strong>Important:</strong> Google SMTP expects this email to match your authenticated Gmail account or a configured <strong>Send Mail As</strong> alias.
                </p>
              </div>

              <p className="text-[10px] text-slate-500 font-medium leading-normal">
                Choose which parties should receive instant email alerts automatically upon saving the transaction. Uncheck both to save without sending automatically.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Send to Sender */}
                <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 hover:border-blue-500/40 rounded-xl cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={shouldSendSender}
                    onChange={(e) => setShouldSendSender(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                  <div className="text-left min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-800">
                      Send to Sender
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono truncate">
                      {senderEmail || "No email specified"}
                    </span>
                  </div>
                </label>

                {/* Send to Receiver */}
                <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 hover:border-blue-500/40 rounded-xl cursor-pointer transition select-none">
                  <input
                    type="checkbox"
                    checked={shouldSendReceiver}
                    onChange={(e) => setShouldSendReceiver(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                  <div className="text-left min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-800">
                      Send to Beneficiary
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono truncate">
                      {receiverEmail || "No email specified"}
                    </span>
                  </div>
                </label>
              </div>

              {!shouldSendSender && !shouldSendReceiver && (
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-700 font-semibold leading-relaxed">
                  💡 Manual dispatch mode: The transaction will be registered/saved on creation. You will manually choose when to dispatch receipt notifications from the success panel.
                </div>
              )}
            </div>

            {previewLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4 border border-slate-150 rounded-2xl bg-slate-50/50 min-h-[400px]">
                <RefreshCw className="h-7 w-7 text-blue-600 animate-spin" />
                <div className="text-center">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Compiling Template...</p>
                  <p className="text-[10px] text-slate-400 mt-1">Generating live transaction receipt layout</p>
                </div>
              </div>
            ) : previewError ? (
              <div className="flex-1 border border-rose-100 rounded-2xl bg-rose-50/20 p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
                <ShieldAlert className="h-8 w-8 text-rose-500" />
                <div>
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Preview Generation Failed</p>
                  <p className="text-xs text-rose-600/80 mt-1">{previewError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Trigger a re-run of the preview effect
                    setCurrentStep(3);
                    setTimeout(() => setCurrentStep(4), 50);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition"
                >
                  Retry Render
                </button>
              </div>
            ) : previewData ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Subject Header */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-3">
                  <div className="bg-blue-50 text-blue-700 rounded-lg p-2 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                      Target Subject Line
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-snug">
                      {previewTab === "sender" ? previewData.senderSubject : previewData.receiverSubject}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      To: <strong className="text-slate-600">{previewTab === "sender" ? `${senderName} (${senderEmail})` : `${receiverName} (${receiverEmail})`}</strong>
                    </span>
                  </div>
                </div>

                {/* Email HTML Frame */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 flex-1 relative min-h-[450px] shadow-sm">
                  <iframe
                    srcDoc={previewTab === "sender" ? previewData.senderHtml : previewData.receiverHtml}
                    title="Live Email Receipt Preview"
                    className="w-full h-full absolute inset-0 bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 border border-slate-200 rounded-2xl bg-slate-50 min-h-[400px]">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Preview Available</p>
              </div>
            )}
          </div>
        )}

        {/* Form Buttons */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between mt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              BACK
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition cursor-pointer shadow-md shadow-blue-500/10 ml-auto"
            >
              CONTINUE
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSending}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black uppercase tracking-widest rounded-xl transition cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto ml-auto justify-center"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  DISPATCHING EMAILS...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  CREATE & DISPATCH EMAILS
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
