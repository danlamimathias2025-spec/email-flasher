/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  Building, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  FileText, 
  User, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Mail, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  Hash,
  Eye,
  RefreshCw,
  X
} from "lucide-react";
import { Transaction, Currency, SenderInfo, ReceiverInfo, TransactionStatus, EmailTemplateType } from "../types";
import { ALL_CURRENCIES } from "../utils/currencies";
import CurrencySelector from "./CurrencySelector";

interface TransferWizardProps {
  onTransferSuccess: (newTx: Transaction) => void;
}

export default function TransferWizard({ onTransferSuccess }: TransferWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Step 1 State: General
  const overrideApiKey = "";
  const [createdTx, setCreatedTx] = useState<Transaction | null>(null);
  const [sendNowLoading, setSendNowLoading] = useState(false);
  const [sendNowResult, setSendNowResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bankName, setBankName] = useState("Union Trust Bank");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [supportLink, setSupportLink] = useState("https://uniontrust.com/support");
  const [amount, setAmount] = useState<number>(12500);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(ALL_CURRENCIES[0]); // default USD
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<TransactionStatus>("successful");
  const [description, setDescription] = useState("Corporate Invoice Payment");
  const [note, setNote] = useState("Invoice #CN-2026-904");

  // Step 2 State: Sender
  const [senderName, setSenderName] = useState("Sarah Jenkins");
  const [senderEmail, setSenderEmail] = useState("sarah.j@example.com");
  const [senderBankName, setSenderBankName] = useState("Union Trust Bank");
  const [senderAccountNumber, setSenderAccountNumber] = useState("89201948293");
  const [senderSwiftCode, setSenderSwiftCode] = useState("UTBKN2YXXX");

  // Step 3 State: Receiver
  const [receiverName, setReceiverName] = useState("Marcus Vance");
  const [receiverEmail, setReceiverEmail] = useState("marcus.v@example.com");
  const [receiverBankName, setReceiverBankName] = useState("Standard Apex Capital");
  const [receiverAccountNumber, setReceiverAccountNumber] = useState("1029482910492");
  const [receiverSwiftCode, setReceiverSwiftCode] = useState("APXCH4XXXX");
  const [redBoxMessage, setRedBoxMessage] = useState("CRITICAL TRANSFER DIRECTIVE: Please complete biometric signature verification within 24 hours to secure immediate release.");

  // Step 4 State: Template
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateType>("modern_bank");

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Logo file-upload handlers
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

  // Field validation helper for steps
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!bankName.trim()) return false;
      const isUrl = supportLink.trim().startsWith("http");
      const isEmail = supportLink.trim().includes("@");
      if (!supportLink.trim() || (!isUrl && !isEmail)) return false;
      if (amount <= 0) return false;
      if (!transactionDate) return false;
      if (!description.trim()) return false;
    } else if (step === 2) {
      if (!senderName.trim()) return false;
      if (!senderEmail.trim() || !senderEmail.includes("@")) return false;
      if (!senderBankName.trim()) return false;
      if (!senderAccountNumber.trim()) return false;
      if (!senderSwiftCode.trim()) return false;
    } else if (step === 3) {
      if (!receiverName.trim()) return false;
      if (!receiverEmail.trim() || !receiverEmail.includes("@")) return false;
      if (!receiverBankName.trim()) return false;
      if (!receiverAccountNumber.trim()) return false;
      if (!receiverSwiftCode.trim()) return false;
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
        text: "Please fill out all required fields with valid details before continuing."
      });
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
    setStatusMessage(null);
  };

  // Final Action: Send Transfer Notification
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setStatusMessage({
        type: "error",
        text: "Incomplete details. Please review steps 1-3 to ensure all required fields are populated correctly."
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
      emailTemplate,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch("/api/send-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: transactionPayload,
          sendSender: false,
          sendReceiver: false
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "An error occurred while creating transaction.");
      }

      setStatusMessage({
        type: "success",
        text: "Transaction record created! You can now send the emails."
      });

      // Call success callback to refresh the transaction history dashboard
      const returnedTx = result.transaction || transactionPayload;
      onTransferSuccess(returnedTx);
      setCreatedTx(returnedTx);
      setSendNowResult(null);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: "error",
        text: err.message || "An error occurred while creating transaction."
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNow = async () => {
    if (!createdTx) return;
    setSendNowLoading(true);
    setSendNowResult(null);
    try {
      const response = await fetch("/api/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: createdTx.id,
          sendSender: true,
          sendReceiver: true
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send transactional emails.");
      }
      setSendNowResult({
        type: "success",
        text: `Success! Email alerts successfully sent to ${createdTx.sender.fullName} (${createdTx.sender.email}) and ${createdTx.receiver.fullName} (${createdTx.receiver.email}).`
      });
      if (result.transaction) {
        onTransferSuccess(result.transaction);
        setCreatedTx(result.transaction);
      }
    } catch (err: any) {
      console.error(err);
      setSendNowResult({
        type: "error",
        text: err.message || "Failed to send email alerts. Please verify that your API keys are configured."
      });
    } finally {
      setSendNowLoading(false);
    }
  };

  const resetWizard = () => {
    setCreatedTx(null);
    setCurrentStep(1);
    setAmount(100);
    setNote("");
    setRedBoxMessage("");
    setStatusMessage(null);
  };

  if (createdTx) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full" id="transfer-wizard">
        <div className="bg-slate-950 px-6 py-6 border-b border-slate-800 text-white shrink-0">
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            TRANSFER & EMAIL CREATED
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Transaction successfully generated & saved to history database
          </p>
        </div>

        <div className="p-6 space-y-6 flex-1 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center">
              <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-emerald-950 text-sm">Transaction Saved Successfully</h3>
              <p className="text-xs text-emerald-700 mt-1">
                Reference ID: <span className="font-mono font-bold">{createdTx.id}</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-xs text-slate-700">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-2">Receipt & Email Metadata</h4>
              <div className="grid grid-cols-2 gap-y-2">
                <span className="text-slate-500 font-medium">Bank Institution:</span>
                <span className="font-bold text-slate-900 text-right">{createdTx.bankName}</span>

                <span className="text-slate-500 font-medium">Transfer Amount:</span>
                <span className="font-extrabold text-blue-700 text-right">{createdTx.currency.symbol}{createdTx.amount.toLocaleString()} {createdTx.currency.code}</span>

                <span className="text-slate-500 font-medium">From Sender:</span>
                <span className="font-semibold text-slate-900 text-right">{createdTx.sender.fullName}</span>
                <span className="text-slate-400 pl-4">Sender Email:</span>
                <span className="font-mono text-slate-600 text-right">{createdTx.sender.email}</span>

                <span className="text-slate-500 font-medium">To Beneficiary:</span>
                <span className="font-semibold text-slate-900 text-right">{createdTx.receiver.fullName}</span>
                <span className="text-slate-400 pl-4">Beneficiary Email:</span>
                <span className="font-mono text-slate-600 text-right">{createdTx.receiver.email}</span>

                <span className="text-slate-500 font-medium">Selected Design:</span>
                <span className="font-semibold text-slate-900 text-right uppercase text-[10px]">{createdTx.emailTemplate.replace("_", " ")}</span>
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
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200">
            {/* SEND NOW BUTTON */}
            <button
              type="button"
              disabled={sendNowLoading || createdTx.emailsSent?.sender || createdTx.emailsSent?.receiver}
              onClick={handleSendNow}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-700 hover:bg-blue-800 disabled:bg-emerald-600 disabled:hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md shadow-blue-100 disabled:shadow-none"
            >
              {sendNowLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  DISPATCHING EMAIL ALERTS...
                </>
              ) : (createdTx.emailsSent?.sender || createdTx.emailsSent?.receiver) ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  EMAIL ALERTS DISPATCHED
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  SEND EMAIL ALERTS NOW
                </>
              )}
            </button>

            {/* RESET / NEW TRANSFER BUTTON */}
            <button
              type="button"
              onClick={resetWizard}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
            >
              CREATE ANOTHER TRANSFER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full" id="transfer-wizard">
      {/* Header with wizard step indicator */}
      <div className="bg-slate-950 px-6 py-6 border-b border-slate-800 text-white">
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-500" />
            RECEIPT & EMAIL DISPATCHER
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            Create secure transfers & send verified transactional emails
          </p>
        </div>

        {/* Status Line Steps */}
        <div className="flex items-center justify-between mt-4 max-w-md mx-auto">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] transition-all duration-300 ${
                    currentStep === step
                      ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                      : currentStep > step
                      ? "bg-green-600 text-white"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {step}
                </div>
                <span className="text-[9px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
                  {step === 1 ? "Setup" : step === 2 ? "Sender" : step === 3 ? "Receiver" : "Template"}
                </span>
              </div>
              {step < 4 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-all duration-500 ${
                    currentStep > step ? "bg-green-600" : "bg-slate-800"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main wizard viewport */}
      <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
        {statusMessage && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border ${
              statusMessage.type === "success"
                ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                : "bg-rose-50/50 border-rose-100 text-rose-800"
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

        {/* STEP 1: Receipt Parameters */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Step 1: Transaction Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Bank Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Chartered International"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Support link */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Support Contact Link or Email/Gmail *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. support@gmail.com or https://support.interbank.com"
                  value={supportLink}
                  onChange={(e) => setSupportLink(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Custom Logo Upload */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                Custom Bank Logo (Leave empty for default)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50/50">
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
                    <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                      <Building className="h-5 w-5" />
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-750">
                      {logoUrl ? "Logo Loaded Successfully" : "Upload PNG/JPG logo"}
                    </p>
                    <p className="text-[10px] text-slate-400">Recommended horizontal layout</p>
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
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm"
                  >
                    Select File
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Currency Selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Currency Search *
                </label>
                <CurrencySelector
                  selectedCurrency={selectedCurrency}
                  onSelectCurrency={setSelectedCurrency}
                />
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Amount *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500 text-sm font-mono">{selectedCurrency.symbol}</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-semibold text-slate-800"
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Purchase of Equipment"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Additional Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Escrow account dispatch"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sender's Information */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Step 2: Party Identification</h3>
              <p className="text-[10px] font-black text-blue-700 bg-blue-50 py-1 px-2.5 rounded inline-block">SENDER (ORIGINATOR)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Sender's legal name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="sender@example.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                Bank Name *
              </label>
              <input
                type="text"
                required
                placeholder="Sender's holding financial institution"
                value={senderBankName}
                onChange={(e) => setSenderBankName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account number */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Account / SWIFT *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Sender's account number / IBAN"
                  value={senderAccountNumber}
                  onChange={(e) => setSenderAccountNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              {/* Swift Code */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  SWIFT BIC Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="8 or 11 characters"
                  value={senderSwiftCode}
                  onChange={(e) => setSenderSwiftCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Receiver's Information */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Step 3: Party Identification</h3>
              <p className="text-[10px] font-black text-indigo-700 bg-indigo-50 py-1 px-2.5 rounded inline-block">RECEIVER (BENEFICIARY)</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Beneficiary's legal name"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="beneficiary@example.com"
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Bank Name */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                Bank Name *
              </label>
              <input
                type="text"
                required
                placeholder="Beneficiary's holding financial institution"
                value={receiverBankName}
                onChange={(e) => setReceiverBankName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account number */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  Account / SWIFT *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Beneficiary's account number / IBAN"
                  value={receiverAccountNumber}
                  onChange={(e) => setReceiverAccountNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              {/* Swift Code */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  SWIFT BIC Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="8 or 11 characters"
                  value={receiverSwiftCode}
                  onChange={(e) => setReceiverSwiftCode(e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Red Box Message */}
            <div className="bg-red-50 border-2 border-dashed border-red-200 p-4 rounded-xl mt-4">
              <label className="block text-[11px] font-bold text-red-700 mb-2 uppercase italic">
                ⚠️ Receiver's Alert Box Message
              </label>
              <textarea
                placeholder="Please confirm receipt of these funds within 24 hours to avoid reversal..."
                value={redBoxMessage}
                onChange={(e) => setRedBoxMessage(e.target.value)}
                rows={3}
                className="w-full border border-red-200 rounded p-2 text-sm text-red-800 bg-white h-20 outline-none focus:ring-2 focus:ring-red-500/20 resize-none font-medium placeholder-red-300"
              />
              <p className="text-[10px] text-red-500 mt-1.5 font-semibold">
                * This message is private & only displayed on the Beneficiary's copy of the receipt.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Choose Template & Preview */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Step 4: Select Email Design Template</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Template choice 1 */}
              <button
                type="button"
                onClick={() => setEmailTemplate("modern_bank")}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  emailTemplate === "modern_bank"
                    ? "border-blue-600 bg-blue-50/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 text-sm">🏛️ Modern Bank</span>
                    {emailTemplate === "modern_bank" && (
                      <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Rich corporate styling with structured header bands, distinct tabular columns, transaction details, and a dynamic support contact link in the email footer.
                  </p>
                </div>
                <div className="mt-4 border border-slate-150 rounded p-1 bg-slate-50 flex items-center justify-center">
                  <div className="w-full h-12 bg-slate-900 rounded flex items-center px-2 text-[8px] text-white font-mono justify-between">
                    <span>🏦 {bankName}</span>
                    <span className="text-[7px]">Ref: TX...</span>
                  </div>
                </div>
              </button>

              {/* Template choice 2 */}
              <button
                type="button"
                onClick={() => setEmailTemplate("minimal_clean")}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  emailTemplate === "minimal_clean"
                    ? "border-blue-600 bg-blue-50/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900 text-sm">🌿 Minimal Clean</span>
                    {emailTemplate === "minimal_clean" && (
                      <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    A sleek, elegant, centered column layout utilizing generous white-space, deep typography pairings, and clean aesthetic lines.
                  </p>
                </div>
                <div className="mt-4 border border-slate-150 rounded p-1 bg-slate-50 flex items-center justify-center">
                  <div className="w-full h-12 bg-white rounded border border-slate-200 flex flex-col justify-center items-center text-[8px] text-slate-800 font-mono">
                    <span className="font-bold">{bankName}</span>
                    <span className="text-slate-400 text-[6px]">Payment Alert</span>
                  </div>
                </div>
              </button>
            </div>
            
            {/* Email client rendering validation statement */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
              <p className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Universal Client Compatibility Guaranteed
              </p>
              <p className="leading-relaxed">
                Both email designs have been engineered with strictly inline HTML styles, nested layouts, and fallback typography optimized specifically for iPhone Mail, Samsung Email, and mobile Gmail apps.
              </p>
            </div>

            {/* Summary Review Area before submitting */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
              <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5">Transfer Summary Review</h4>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-slate-500">Bank Display:</span>
                <span className="font-semibold text-slate-800 text-right">{bankName}</span>

                <span className="text-slate-500">Transfer Amount:</span>
                <span className="font-bold text-blue-700 text-right">{selectedCurrency.symbol}{amount.toLocaleString()} {selectedCurrency.code}</span>

                <span className="text-slate-500">Sender:</span>
                <span className="font-semibold text-slate-800 text-right">{senderName} ({senderEmail})</span>

                <span className="text-slate-500">Receiver:</span>
                <span className="font-semibold text-slate-800 text-right">{receiverName} ({receiverEmail})</span>

                <span className="text-slate-500">Private Alert Warning:</span>
                <span className="font-semibold text-rose-600 text-right truncate pl-4">{redBoxMessage || "None"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between mt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              PREVIOUS STEP
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer shadow shadow-blue-200 ml-auto"
            >
              CONTINUE
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSending}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed shadow w-full justify-center sm:w-auto ml-auto font-bold"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  CREATING TRANSFER...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  CREATE TRANSFER & EMAILS
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
