/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Mail, 
  Globe, 
  X, 
  ArrowRight,
  Info,
  Layers,
  HeartHandshake,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Lock,
  ShieldCheck,
  MessageCircle
} from "lucide-react";
import { Transaction, TransactionStatus } from "./types";
import { ALL_CURRENCIES } from "./utils/currencies";
import TransferWizard from "./components/TransferWizard";
import TransactionDashboard from "./components/TransactionDashboard";

// Sample Initial Seeds in case backend is empty
const MOCK_SEEDS: Transaction[] = [
  {
    id: "TX-APX749A9-4930",
    bankName: "Barclays Private Wealth",
    supportLink: "https://barclays.com/support",
    amount: 450000.00,
    currency: { code: "GBP", name: "British Pound", symbol: "£", country: "United Kingdom" },
    date: new Date(Date.now() - 4 * 3600000).toISOString().split("T")[0],
    status: "successful",
    description: "Property Acquisition Deposit",
    note: "Escrow account dispatch",
    sender: {
      fullName: "Isabella Harrington",
      email: "i.harrington@wealth-mgmt.com",
      bankName: "Barclays Private Wealth",
      accountNumber: "GB29BARC302948103948",
      swiftCode: "BARCGB22XXX"
    },
    receiver: {
      fullName: "Prestige Estates Ltd",
      email: "acquisitions@prestige-estates.co.uk",
      bankName: "Lloyds Development Bank",
      accountNumber: "GB44LLOY402948291049",
      swiftCode: "LOYDGB21XXX",
      redBoxMessage: "IMPORTANT WARNING: This transfer is flagged for immediate real-estate clearance. Please submit your development escrow authorization deed to unlock prompt routing."
    },
    emailTemplate: "modern_bank",
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    emailsSent: { sender: true, receiver: true }
  },
  {
    id: "TX-SOL881V9-0294",
    bankName: "Solana Capital Bank",
    supportLink: "https://solana.com/legal",
    amount: 350.25,
    currency: { code: "SOL", name: "Solana", symbol: "SOL", country: "Solana Network" },
    date: new Date(Date.now() - 24 * 3600000).toISOString().split("T")[0],
    status: "pending",
    description: "DeFi LP Liquidity Injection",
    sender: {
      fullName: "Alex Rivera",
      email: "alex.rivera@solmail.net",
      bankName: "Solana Web3 Wallet",
      accountNumber: "6xdH72yU81pZa9qWksD71h9Lpo",
      swiftCode: "SOLANAXXXX"
    },
    receiver: {
      fullName: "Raydium Pool Custodian",
      email: "liquidity-router@raydium.io",
      bankName: "Solana Smart Contract Pool",
      accountNumber: "9yH81aPo9qWksD71h9LpDk90As",
      swiftCode: "SOLANAPOOL"
    },
    emailTemplate: "minimal_clean",
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    emailsSent: { sender: true, receiver: false, error: "Receiver address raydium.io rejected standard SMTP handshakes." }
  }
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [previewRole, setPreviewRole] = useState<"sender" | "receiver">("receiver");
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // App Access Gate State
  const [accessCode, setAccessCode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem("app_access_granted") === "true";
  });
  const [accessError, setAccessError] = useState("");

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim() === "987123") {
      localStorage.setItem("app_access_granted", "true");
      setIsAuthorized(true);
      setAccessError("");
    } else {
      setAccessError("Invalid access key. Please verify your code and try again.");
    }
  };

  useEffect(() => {
    setResendStatus(null);
  }, [activeTx]);

  const handleResendEmail = async (txId: string) => {
    setIsResending(true);
    setResendStatus(null);
    try {
      const response = await fetch("/api/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txId,
          sendSender: true,
          sendReceiver: true
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to resend transactional emails.");
      }
      setResendStatus({
        type: "success",
        text: "Transactional emails resent successfully!"
      });
      if (result.transaction) {
        setTransactions(prev => prev.map(t => t.id === txId ? result.transaction : t));
        setActiveTx(result.transaction);
      }
    } catch (err: any) {
      console.error(err);
      setResendStatus({
        type: "error",
        text: err.message || "An error occurred while resending emails."
      });
    } finally {
      setIsResending(false);
    }
  };

  // Load Transactions from backend API on mount
  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/transactions");
      if (response.ok) {
        const data = await response.json();
        if (data.length === 0) {
          const wasCleared = localStorage.getItem("transfer_history_cleared");
          if (!wasCleared) {
            // If server database is brand new, seed with our high-quality records
            setTransactions(MOCK_SEEDS);
            // Post seeds to server database for persistence
            for (const seed of MOCK_SEEDS) {
              await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(seed)
              });
            }
          } else {
            setTransactions([]);
          }
        } else {
          setTransactions(data);
        }
      }
    } catch (err) {
      console.error("Failed to connect to backend api. Using client mock storage:", err);
      setTransactions(MOCK_SEEDS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    const confirmClear = window.confirm("Are you sure you want to permanently clear all transaction history?");
    if (!confirmClear) return;
    try {
      localStorage.setItem("transfer_history_cleared", "true");
      const response = await fetch("/api/transactions", {
        method: "DELETE"
      });
      if (response.ok) {
        setTransactions([]);
        setActiveTx(null);
      }
    } catch (err) {
      console.error("Error clearing transaction history:", err);
      setTransactions([]);
      setActiveTx(null);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Update records on new successful transfer dispatch
  const handleTransferSuccess = (newTx: Transaction) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === newTx.id);
      if (exists) {
        return prev.map((t) => (t.id === newTx.id ? newTx : t));
      } else {
        return [newTx, ...prev];
      }
    });
    setActiveTx(newTx); // Automatically open receipt review
  };

  const statusStyles = (status: TransactionStatus) => {
    switch (status) {
      case "successful":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "failed":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans" id="access-gate">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
          
          {/* Accent decoration */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600" />

          <div className="p-8 space-y-6">
            {/* Header/Branding */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-blue-950 text-blue-400 border border-blue-800/45 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">GLOBAL TRANSFER PRO</h2>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Secure Terminal Access Gate</p>
            </div>

            <div className="border-t border-slate-800/60 my-4" />

            {/* Error Message */}
            {accessError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold text-center leading-relaxed animate-shake">
                {accessError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Access Authorization Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white rounded-lg px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none transition-all placeholder:text-slate-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-blue-950 cursor-pointer"
              >
                Unlock Terminal Access
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800/60"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold">Need a Key?</span>
              <div className="flex-grow border-t border-slate-800/60"></div>
            </div>

            {/* Whatsapp Buy Access Link */}
            <div className="space-y-3">
              <a
                href="https://wa.me/2348082076038"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-emerald-950 cursor-pointer"
              >
                <MessageCircle className="h-4.5 w-4.5" />
                Buy Access Code
              </a>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                Tap to chat with our authorized support desk on WhatsApp to buy your direct system access key instantly.
              </p>
            </div>

          </div>
        </div>

        {/* Outer subtle license footer */}
        <p className="text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
          © 2026 GLOBAL TRANSFER PRO SECURE NETWORKS
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" id="app-root">
      {/* Global Header / Bank Branding */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded flex items-center justify-center text-white font-bold text-xl italic shadow-md">
            B
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-blue-900">GLOBAL TRANSFER PRO</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Secure Financial Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <a href="#transaction-dashboard" className="text-xs font-semibold text-blue-600 border-b border-blue-600 hover:text-blue-800 transition-colors">
            View Historical Records
          </a>
        </div>
      </header>

      {/* Main Container workspace */}
      <main className="max-w-7xl mx-auto px-4 py-8 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: STEP BY STEP BUILDER WIZARD */}
          <div className="lg:col-span-7 xl:col-span-7 h-full">
            <TransferWizard onTransferSuccess={handleTransferSuccess} />
          </div>

          {/* RIGHT: TRACKING STATUS DASHBOARD */}
          <div className="lg:col-span-5 xl:col-span-5 space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-700" />
                Historical Payments Dashboard
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Real-time tracking of historical money transfers. Click a transaction row to view generated email receipts.
              </p>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                <p className="text-sm font-semibold text-gray-500">Connecting to transaction database...</p>
              </div>
            ) : (
              <TransactionDashboard 
                transactions={transactions} 
                onSelectTransaction={(tx) => {
                  setActiveTx(tx);
                  setPreviewRole("receiver"); // default to receiver copy to verify the red box warning
                }} 
                onClearHistory={handleClearHistory}
              />
            )}
          </div>

        </div>
      </main>

      {/* LIGHTBOX MODAL: GORGEOUS TRANSACTION RECEIPT PREVIEW */}
      {activeTx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="receipt-modal">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-white p-6 flex items-center justify-between border-b border-slate-200 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 py-1 px-2.5 rounded inline-block mb-1">Transaction Auditor</span>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  Reference: {activeTx.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTx(null)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 p-1.5 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Role and Preview toggles */}
            <div className="bg-slate-100/70 px-6 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Preview Layout copy:</span>
                <div className="inline-flex rounded p-1 bg-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPreviewRole("sender")}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                      previewRole === "sender" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Sender Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewRole("receiver")}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all cursor-pointer ${
                      previewRole === "receiver" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Beneficiary copy
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Scrollable viewport */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              
              {/* Quick Actions / Email Resend Status */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-lg mx-auto flex flex-col space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">Email Dispatch Operations</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">Resend transactional receipts to the registered email addresses.</p>
                  </div>
                  <button
                    type="button"
                    disabled={isResending}
                    onClick={() => handleResendEmail(activeTx.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold tracking-wide rounded cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {isResending ? "Resending..." : "Resend Emails"}
                  </button>
                </div>
                
                {resendStatus && (
                  <div className={`p-2.5 rounded text-[11px] font-semibold border ${
                    resendStatus.type === "success" 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}>
                    {resendStatus.text}
                  </div>
                )}
                      {/* simulated email view frame */}
              <div 
                className="border border-slate-300 shadow-lg rounded-xl p-6 sm:p-8 max-w-lg mx-auto relative overflow-hidden text-left"
                style={{ 
                  backgroundColor: '#f7f6f4', 
                  backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22 viewBox=%220 0 4 4%22%3E%3Cpath d=%22M1 3h1v1H1V3zm2-2h1v1H3V1z%22 fill=%22%23e5e3df%22 fill-opacity=%220.4%22/%3E%3C/svg%3E')" 
                }}
              >
                
                {/* Simulated Email App bar */}
                <div className="border-b border-slate-300 pb-3 mb-6 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <div>
                    <div><span className="text-slate-400">From:</span> {activeTx.bankName} Alert Service</div>
                    <div className="mt-1">
                      <span className="text-slate-400">To:</span> {previewRole === "sender" ? activeTx.sender.email : <span className="italic text-slate-400 font-normal">[Invisible for Privacy]</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{activeTx.date}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Vias SMTP Secure</div>
                  </div>
                </div>

                {/* 1. TOP HEADER TEXT */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-black leading-tight">
                    Payment Notification - {activeTx.id}
                  </h3>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <span>to me</span>
                    <span className="text-[9px] text-gray-400">▼</span>
                  </div>
                </div>

                {/* 2. LOGO BANNER */}
                <div className="bg-[#0d2149] rounded-lg p-4 flex items-center justify-center gap-3 mb-6">
                  <svg className="w-8 h-8 text-[#4f83f7] fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="12,2 2,9 22,9" />
                    <rect x="3" y="10" width="18" height="2" />
                    <rect x="5" y="13" width="2" height="7" />
                    <rect x="9" y="13" width="2" height="7" />
                    <rect x="13" y="13" width="2" height="7" />
                    <rect x="17" y="13" width="2" height="7" />
                    <rect x="2" y="21" width="20" height="2" />
                  </svg>
                  <span className="font-sans font-black text-xl tracking-wider text-[#4f83f7] uppercase">
                    {activeTx.bankName.toUpperCase()}
                  </span>
                </div>

                {/* 3. TRANSACTION AMOUNT */}
                <div className="text-center mb-6">
                  <div className="text-xs font-black text-black tracking-wider uppercase mb-1">
                    TRANSACTION AMOUNT
                  </div>
                  <div className="text-3xl font-bold text-black">
                    {activeTx.currency.symbol}{activeTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* 4. WARNING NOTICE BOX */}
                {previewRole === "receiver" && activeTx.receiver.redBoxMessage && (
                  <div className="bg-[#fdf2f2] border-l-4 border-l-[#dc2626] rounded-lg p-3.5 mb-6 flex items-start gap-2 text-left">
                    <svg className="w-5 h-5 text-yellow-500 fill-current shrink-0 mt-0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 22h20L12 2zm-1 15h2v2h-2v-2zm0-8h2v6h-2V9z" />
                    </svg>
                    <span className="text-xs font-semibold leading-relaxed text-[#991b1b]">
                      {activeTx.receiver.redBoxMessage}
                    </span>
                  </div>
                )}

                {/* 5. TRANSACTION DETAILS SECTION */}
                <div className="mb-6">
                  <div className="text-left mb-3">
                    <span className="text-sm font-extrabold text-[#0b2545] border-b-2 border-[#0b2545] pb-1 inline-block">
                      Transaction Details
                    </span>
                  </div>

                  <div className="bg-white border border-gray-300 rounded-lg overflow-hidden p-4">
                    <div className="divide-y divide-gray-100 text-xs">
                      
                      {/* Receiver Name */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Receiver Name</span>
                        <span className="text-black text-right">{activeTx.receiver.fullName}</span>
                      </div>

                      {/* Sender Name */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Sender Name</span>
                        <span className="text-black text-right">{activeTx.sender.fullName}</span>
                      </div>

                      {/* Account Number */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Account Number</span>
                        <span className="text-black font-mono text-right">{activeTx.receiver.accountNumber}</span>
                      </div>

                      {/* SWIFT Code */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">SWIFT Code</span>
                        <span className="text-black font-mono text-right">{activeTx.receiver.swiftCode}</span>
                      </div>

                      {/* Transaction ID */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Transaction ID</span>
                        <span className="text-black font-mono text-right">{activeTx.id}</span>
                      </div>

                      {/* Date/Time */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Date/Time</span>
                        <span className="text-black text-right">
                          {new Date(activeTx.date).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric"
                          }) + " " + new Date(activeTx.date).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          })}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="font-bold text-[#0b2545]">Status</span>
                        <span className="bg-[#16a34a] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                          {activeTx.status.toUpperCase()}
                        </span>
                      </div>

                    </div>
                  </div>
                </div>

                {/* 6. FOOTER TEXT */}
                <div className="text-center pt-2">
                  <div className="text-[11px] text-gray-600 font-medium flex items-center justify-center gap-1 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-yellow-700 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                    <span>Secured by {activeTx.bankName.replace(/\s+/g, '').toUpperCase()} advanced encryption technology.</span>
                  </div>
                  <div className="text-[11px] text-gray-600 font-medium">
                    For assistance, please{" "}
                    <a 
                      href={activeTx.supportLink.includes("@") && !activeTx.supportLink.startsWith("mailto:") ? `mailto:${activeTx.supportLink}` : activeTx.supportLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline font-bold"
                    >
                      contact support
                    </a>
                    .
                  </div>
                </div>

              </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-white p-5 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-slate-500 text-[10px] font-semibold">Processed at: {new Date(activeTx.createdAt).toLocaleString()}</span>
              <button
                type="button"
                onClick={() => setActiveTx(null)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-lg font-bold text-xs tracking-wide shadow-md shadow-blue-200 transition cursor-pointer"
              >
                CLOSE PREVIEW
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
