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
              </div>

              {/* simulated email view frame */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 sm:p-8 max-w-lg mx-auto relative overflow-hidden">
                
                {/* Simulated Email App bar */}
                <div className="border-b border-slate-100 pb-3 mb-6 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <div>
                    <div><span className="text-slate-400">From:</span> {activeTx.bankName} Alert Service</div>
                    <div className="mt-1">
                      <span className="text-slate-400">To:</span> {previewRole === "sender" ? activeTx.sender.email : <span className="italic text-slate-300 font-normal">[Invisible for Privacy]</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{activeTx.date}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Vias SMTP Secure</div>
                  </div>
                </div>

                {/* Receiver red box warning ONLY on receiver role */}
                {previewRole === "receiver" && activeTx.receiver.redBoxMessage && (
                  <div className="bg-red-50 border-2 border-dashed border-red-200 p-4 rounded-xl mb-6 text-xs text-left">
                    <h5 className="block text-[11px] font-bold text-red-700 mb-2 uppercase italic flex items-center gap-1">
                      <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                      ⚠️ Receiver's Alert Box Message
                    </h5>
                    <p className="font-semibold leading-relaxed text-red-900">{activeTx.receiver.redBoxMessage}</p>
                  </div>
                )}

                {/* Rendered Template Body (Using elegant client-side simulation) */}
                {activeTx.emailTemplate === "modern_bank" ? (
                  // Modern Bank design
                  <div className="space-y-6 text-left text-xs">
                    {/* Header bar */}
                    <div className="bg-slate-900 p-4 rounded-xl text-white flex justify-between items-center">
                      <span className="font-bold tracking-tight text-sm">🏦 {activeTx.bankName}</span>
                      <span className="text-[9px] font-mono text-slate-400">Official Receipt</span>
                    </div>

                    {/* Receiver warning insert inside body */}
                    {previewRole === "receiver" && activeTx.receiver.redBoxMessage && (
                      <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-4 font-sans text-left">
                        <h4 className="text-rose-700 font-extrabold text-xs mb-1">⚠️ Notification for Receiver</h4>
                        <p className="text-rose-800 font-semibold leading-relaxed text-xs">{activeTx.receiver.redBoxMessage}</p>
                      </div>
                    )}

                    {/* Transaction Hero */}
                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-gray-100">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-center border ${
                        activeTx.status === "successful"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : activeTx.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        ● {activeTx.status.toUpperCase()}
                      </span>
                      <h2 className="text-2xl font-black text-slate-900 mt-2">
                        {activeTx.currency.symbol}{activeTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-sm font-semibold text-gray-500 ml-1">{activeTx.currency.code}</span>
                      </h2>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">Transaction Ref: {activeTx.id}</p>
                    </div>

                    {/* Metadata */}
                    <table className="w-full text-left divide-y divide-gray-100 text-[11px]">
                      <tbody>
                        <tr className="py-2.5">
                          <td className="py-2 text-gray-500">Description</td>
                          <td className="py-2 text-right font-semibold text-gray-800">{activeTx.description}</td>
                        </tr>
                        {activeTx.note && (
                          <tr className="py-2.5">
                            <td className="py-2 text-gray-500">Note</td>
                            <td className="py-2 text-right font-medium text-gray-700 italic">"{activeTx.note}"</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Sender block */}
                    <div className="border-t border-gray-100 pt-3">
                      <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-2">Sender Details</h5>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-gray-400">Full Name</span>
                        <span className="font-semibold text-right text-gray-800">{activeTx.sender.fullName}</span>

                        {previewRole !== "receiver" && (
                          <>
                            <span className="text-gray-400">Email Address</span>
                            <span className="font-medium text-right text-gray-800 break-all">{activeTx.sender.email}</span>
                          </>
                        )}

                        <span className="text-gray-400">Bank Name</span>
                        <span className="font-medium text-right text-gray-800">{activeTx.sender.bankName}</span>

                        <span className="text-gray-400">Account / IBAN</span>
                        <span className="font-mono text-right text-gray-800">{activeTx.sender.accountNumber}</span>

                        <span className="text-gray-400">SWIFT BIC</span>
                        <span className="font-mono text-right text-gray-800">{activeTx.sender.swiftCode}</span>
                      </div>
                    </div>

                    {/* Receiver block */}
                    <div className="border-t border-gray-100 pt-3">
                      <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[9px] mb-2">Beneficiary Details</h5>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <span className="text-gray-400">Full Name</span>
                        <span className="font-semibold text-right text-gray-800">{activeTx.receiver.fullName}</span>

                        {previewRole !== "receiver" && (
                          <>
                            <span className="text-gray-400">Email Address</span>
                            <span className="font-medium text-right text-gray-800 break-all">{activeTx.receiver.email}</span>
                          </>
                        )}

                        <span className="text-gray-400">Bank Name</span>
                        <span className="font-medium text-right text-gray-800">{activeTx.receiver.bankName}</span>

                        <span className="text-gray-400">Account / IBAN</span>
                        <span className="font-mono text-right text-gray-800">{activeTx.receiver.accountNumber}</span>

                        <span className="text-gray-400">SWIFT BIC</span>
                        <span className="font-mono text-right text-gray-800">{activeTx.receiver.swiftCode}</span>
                      </div>
                    </div>

                    {/* Support footer */}
                    <div className="border-t border-gray-100 pt-4 text-center">
                      <a 
                        href={activeTx.supportLink.includes("@") && !activeTx.supportLink.startsWith("mailto:") ? `mailto:${activeTx.supportLink}` : activeTx.supportLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition"
                      >
                        Contact Support Assistance
                      </a>
                    </div>
                  </div>
                ) : (
                  // Minimal Clean design
                  <div className="space-y-6 text-left text-xs text-gray-700">
                    <div className="text-center">
                      <h4 className="text-base font-extrabold text-gray-950 uppercase tracking-tight">{activeTx.bankName}</h4>
                      <p className="text-[10px] text-gray-400 tracking-widest mt-0.5">PAYMENT NOTIFICATION</p>
                    </div>

                    {/* Receiver warning insert inside body */}
                    {previewRole === "receiver" && activeTx.receiver.redBoxMessage && (
                      <div className="bg-red-600 rounded p-4 text-left">
                        <p className="text-white font-semibold leading-relaxed text-xs">⚠️ Receiver Message: {activeTx.receiver.redBoxMessage}</p>
                      </div>
                    )}

                    <div className="text-center py-6 border-b border-t border-gray-100">
                      <h2 className="text-3xl font-extrabold text-gray-950">
                        {activeTx.currency.symbol}{activeTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-base font-normal text-gray-400 ml-1">{activeTx.currency.code}</span>
                      </h2>
                      <div className="mt-2.5">
                        <span className={`inline-block px-3 py-0.5 rounded text-[10px] font-bold border ${
                          activeTx.status === "successful"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : activeTx.status === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {activeTx.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Transfer Description</div>
                        <div className="font-semibold text-gray-800">{activeTx.description}</div>
                        {activeTx.note && <div className="text-gray-500 italic mt-0.5">Note: "{activeTx.note}"</div>}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">From Sender</div>
                          <div className="font-bold text-gray-900 text-[11px]">{activeTx.sender.fullName}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">{activeTx.sender.bankName}</div>
                          <div className="font-mono text-gray-400 text-[10px]">{activeTx.sender.accountNumber}</div>
                        </div>

                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">To Beneficiary</div>
                          <div className="font-bold text-gray-900 text-[11px]">{activeTx.receiver.fullName}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">{activeTx.receiver.bankName}</div>
                          <div className="font-mono text-gray-400 text-[10px]">{activeTx.receiver.accountNumber}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 text-center border-t border-gray-100">
                      <a 
                        href={activeTx.supportLink.includes("@") && !activeTx.supportLink.startsWith("mailto:") ? `mailto:${activeTx.supportLink}` : activeTx.supportLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-gray-800 font-bold underline hover:text-blue-600 transition"
                      >
                        Contact Secure Support
                      </a>
                    </div>
                  </div>
                )}

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
