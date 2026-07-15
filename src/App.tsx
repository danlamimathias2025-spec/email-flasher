/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building, 
  Lock, 
  MessageCircle, 
  WifiOff,
  ShieldCheck,
  FileText,
  Home,
  LogOut,
  X,
  Mail,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  User,
  ExternalLink,
  RefreshCw,
  Check,
  Copy,
  CreditCard
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { Transaction, TransactionStatus } from "./types";
import TransferWizard from "./components/TransferWizard";
import TransactionDashboard from "./components/TransactionDashboard";
import { safeFetchJson, getLocalTransactions, clearLocalTransactions } from "./utils/api";

export default function App() {
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "history" | "email">("home");

  // App Access Gate State
  const [accessCode, setAccessCode] = useState("");
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem("user_email") || "";
  });
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return localStorage.getItem("user_email") || "";
  });
  
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem("app_access_granted") === "true";
  });
  const [accessError, setAccessError] = useState("");
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const copyToClipboard = (text: string, isEmail: boolean) => {
    navigator.clipboard.writeText(text);
    if (isEmail) {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
      toast.success("Email address copied!");
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
      toast.success("App Password copied!");
    }
  };

  // Transaction ledger state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Email resending state in detail modal
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSender, setResendSender] = useState(true);
  const [resendReceiver, setResendReceiver] = useState(true);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userEmail.trim() || !userEmail.includes("@")) {
      setAccessError("Please enter a valid email address to continue.");
      return;
    }
    if (accessCode.trim() !== "987123") {
      setAccessError("Invalid authorization access key. Please try again.");
      return;
    }
    
    setShowEmailPrompt(true);
    setAccessError("");
  };

  const handleCompleteActivation = () => {
    localStorage.setItem("user_email", userEmail.trim());
    localStorage.setItem("app_access_granted", "true");
    setCurrentUserEmail(userEmail.trim());
    setIsAuthorized(true);
    setShowEmailPrompt(false);
    toast.success(`Access granted! Session initialized for ${userEmail.trim()}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("app_access_granted");
    setIsAuthorized(false);
    setAccessCode("");
    toast.success("Logged out successfully");
  };

  // Check connection state to backend API on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const result = await safeFetchJson<any>("/api/transactions");
        if (result.error || !result.data) {
          setIsLocalMode(true);
        } else {
          setIsLocalMode(false);
        }
      } catch (err) {
        setIsLocalMode(true);
      }
    };
    checkBackend();
  }, []);

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    if (isLocalMode) {
      setTransactions(getLocalTransactions());
      setLoadingTransactions(false);
    } else {
      const res = await safeFetchJson<Transaction[]>("/api/transactions");
      if (res.data) {
        setTransactions(res.data);
      } else {
        setTransactions(getLocalTransactions());
      }
      setLoadingTransactions(false);
    }
  };

  // Fetch transactions on authorization or mode change
  useEffect(() => {
    if (isAuthorized) {
      fetchTransactions();
    }
  }, [isAuthorized, isLocalMode]);

  const handleTransferSuccess = (newTx: Transaction) => {
    console.log("Secure transfer transaction processed:", newTx.id);
    fetchTransactions();
  };

  const handleClearHistory = async () => {
    if (isLocalMode) {
      clearLocalTransactions();
      setTransactions([]);
      toast.success("Local history cleared");
    } else {
      const res = await safeFetchJson<{ success: boolean }>("/api/transactions", {
        method: "DELETE"
      });
      if (res.data?.success) {
        setTransactions([]);
        toast.success("Ledger history cleared");
      } else {
        clearLocalTransactions();
        setTransactions([]);
        toast.success("Local history cleared (Fallback)");
      }
    }
  };

  const handleResendEmails = async (tx: Transaction) => {
    setResendLoading(true);
    setResendStatus(null);
    try {
      const senderEmailToUse = localStorage.getItem("mailjet_sender_email") || currentUserEmail || "danlamimathias2025@gmail.com";
      const result = await safeFetchJson<{ success: boolean; results?: { sender: boolean; receiver: boolean }; error?: string }>("/api/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: tx.id,
          transaction: tx,
          sendSender: resendSender,
          sendReceiver: resendReceiver,
          mailjetSenderEmail: senderEmailToUse,
        }),
      });

      if (result.error) {
        toast.error(result.error);
        setResendStatus(`Error: ${result.error}`);
      } else {
        const sStatus = result.data?.results?.sender ? "Delivered" : "Not Sent";
        const rStatus = result.data?.results?.receiver ? "Delivered" : "Not Sent";
        toast.success("Resent dispatch completed!");
        setResendStatus(`Alerts dispatched!\n• Sender Copy: ${sStatus}\n• Beneficiary: ${rStatus}`);
        fetchTransactions();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch resend request");
      setResendStatus(`Error: ${err.message || "Failed to dispatch"}`);
    } finally {
      setResendLoading(false);
    }
  };

  // ACCESS GATE VIEW
  if (!isAuthorized) {
    if (showEmailPrompt) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans animate-fade-in" id="device-email-setup-gate">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden relative">
            
            {/* Top subtle highlight band */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500" />

            <div className="p-8 space-y-6">
              {/* Header / Brand */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-blue-950/40 text-blue-400 border border-blue-800/30 rounded-xl flex items-center justify-center shadow-lg mb-3">
                  <Mail className="h-5 w-5 text-blue-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">DEVICE MAIL SETUP</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">System Email Integration Required</p>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs space-y-2 leading-relaxed text-left">
                <p className="font-bold uppercase text-[9px] tracking-wider text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Mandatory Security Sync
                </p>
                <p>
                  To use this secure terminal and enable automatic transfer notification dispatches, you <strong className="text-white">MUST add and configure the following system Google SMTP account</strong> on your device mail client.
                </p>
              </div>

              {/* Email Credentials Card */}
              <div className="space-y-3.5 bg-slate-950 border border-slate-800 p-4 rounded-xl text-left">
                {/* Email Field */}
                <div className="space-y-1">
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">Email Address</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
                    <code className="text-xs font-mono text-emerald-400 select-all truncate">internationalbank2026@gmail.com</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("internationalbank2026@gmail.com", true)}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy email address"
                    >
                      {copiedEmail ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">App Password</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
                    <code className="text-xs font-mono text-blue-400 select-all font-bold">Bank2026@</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("Bank2026@", false)}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy App password"
                    >
                      {copiedPass ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-normal space-y-1.5 font-medium text-left">
                <p>• Open your device Settings &rarr; Accounts &rarr; Add Google Account.</p>
                <p>• Enter the email and password credentials shown above.</p>
                <p>• Keep the account logged in to ensure flawless SMTP transmission alerts.</p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleCompleteActivation}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-950/50 cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                >
                  <CheckCircle className="h-4 w-4" />
                  I have added this account - Continue
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmailPrompt(false)}
                  className="w-full py-2.5 bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-slate-800 cursor-pointer"
                >
                  Go Back
                </button>
              </div>

            </div>
          </div>
          
          {/* Footer */}
          <p className="text-[9px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
            © 2026 GLOBAL SECURE NETWORKS GROUP
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans" id="access-gate">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden relative">
          
          {/* Top subtle highlight band */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500" />

          <div className="p-8 space-y-6">
            {/* Header / Brand */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-blue-950/40 text-blue-400 border border-blue-800/30 rounded-xl flex items-center justify-center shadow-lg mb-3">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">GLOBAL TRANSFER PRO</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Secure Terminal Access Gate</p>
            </div>

            {/* Error Message */}
            {accessError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold text-center leading-relaxed">
                {accessError}
              </div>
            )}

            {/* Unlock Form */}
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white rounded-xl px-4 py-3 text-sm font-sans focus:outline-none transition-all placeholder:text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  System Access Authorization Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/60 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none transition-all placeholder:text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-950/50 cursor-pointer"
              >
                Access Secure Terminal
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800/40"></div>
              <span className="flex-shrink mx-3 text-[9px] text-slate-500 uppercase tracking-widest font-black">Authorized Activation</span>
              <div className="flex-grow border-t border-slate-800/40"></div>
            </div>

            {/* Whatsapp Gateway */}
            <div className="space-y-3">
              <a
                href="https://wa.me/2348082076038"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <MessageCircle className="h-4.5 w-4.5" />
                Get Access Code
              </a>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed font-medium">
                Tap to connect directly with our secure billing desk on WhatsApp to retrieve an authorized system activation key.
              </p>
            </div>

          </div>
        </div>
        
        {/* Footer */}
        <p className="text-[9px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
          © 2026 GLOBAL SECURE NETWORKS GROUP
        </p>
      </div>
    );
  }

  // CORE WORKSPACE VIEW
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col pb-20" id="app-root">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            fontSize: "11px",
            fontWeight: "700",
            fontFamily: "var(--font-sans), sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            borderRadius: "12px",
            background: "#0f172a",
            color: "#ffffff",
            border: "1px solid #1e293b",
            padding: "12px 16px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#ffffff",
            },
          },
        }}
      />
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-150 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg italic shadow-md shadow-slate-950/10 border border-slate-800">
            G
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none">GLOBAL TRANSFER PRO</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">Authorized Secure Terminal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {currentUserEmail && (
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">Session Profile</span>
              <span className="text-[10px] font-bold text-slate-700 font-mono">{currentUserEmail}</span>
            </div>
          )}

          {isLocalMode ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 text-amber-700 text-[9px] font-black rounded-full uppercase tracking-wider">
              <WifiOff className="h-3 w-3" />
              Local Mode
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[9px] font-black rounded-full uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3" />
              API Active
            </div>
          )}

          <button 
            onClick={handleLogout}
            title="Logout of terminal"
            className="flex items-center gap-1 text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-wider border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      </header>

      {/* Centered Workspace Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {activeTab === "home" ? (
          <TransferWizard onTransferSuccess={handleTransferSuccess} isLocalMode={isLocalMode} />
        ) : activeTab === "history" ? (
          <div className="space-y-4 flex-1 flex flex-col justify-start">
            <div className="text-left mb-1 px-1">
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">Transaction Audit History</h2>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Secure ledger of all terminal transmissions</p>
            </div>
            {loadingTransactions ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
                <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Syncing Ledger Records...</p>
              </div>
            ) : (
              <TransactionDashboard 
                transactions={transactions} 
                onSelectTransaction={(tx) => {
                  setSelectedTransaction(tx);
                  setResendStatus(null);
                }} 
                onClearHistory={handleClearHistory} 
              />
            )}
          </div>
        ) : (
          /* Device SMTP Configuration View */
          <div className="space-y-6 flex-1 flex flex-col justify-start max-w-md mx-auto w-full animate-fade-in">
            <div className="text-left mb-1 px-1">
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">Device SMTP Configuration</h2>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Device Mail Client Access Information</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="p-4 bg-blue-50 border border-blue-150 rounded-xl space-y-1.5 text-left">
                <h3 className="font-black text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-blue-500" />
                  SMTP Mail Integration
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  This system utilizes secure Gmail SMTP. To ensure flawless automatic receiver-side alert deliveries, you must have this account configured on your active device mail client.
                </p>
              </div>

              {/* Email Credentials UI */}
              <div className="space-y-4">
                <div className="space-y-1 text-left">
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">SMTP Account Email</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                    <code className="text-xs font-mono text-slate-800 select-all truncate">internationalbank2026@gmail.com</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("internationalbank2026@gmail.com", true)}
                      className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                      title="Copy email address"
                    >
                      {copiedEmail ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider">Device SMTP App Password</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                    <code className="text-xs font-mono text-slate-800 select-all font-bold">Bank2026@</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("Bank2026@", false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                      title="Copy App password"
                    >
                      {copiedPass ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-wider text-left">Setup Steps:</h4>
                <ol className="text-[11px] text-slate-500 space-y-2 text-left list-decimal pl-4 leading-relaxed font-semibold">
                  <li>Navigate to Settings &rarr; Accounts &rarr; Add Account on your active smartphone or computer.</li>
                  <li>Choose <strong className="text-slate-700">Google / Gmail</strong> as the provider type.</li>
                  <li>Authenticate with the system email and application password listed above.</li>
                  <li>Enable Mail Sync to ensure your device successfully registers authorization handshakes.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom Navigation Bar */}
      <div className="bg-white border-t border-slate-200/80 fixed bottom-0 inset-x-0 z-45 py-2 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-around px-4">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === "home" 
                ? "text-blue-600 font-black scale-105" 
                : "text-slate-400 hover:text-slate-600 font-bold"
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[9px] uppercase tracking-wider">New Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === "email" 
                ? "text-blue-600 font-black scale-105" 
                : "text-slate-400 hover:text-slate-600 font-bold"
            }`}
          >
            <Mail className="h-5 w-5" />
            <span className="text-[9px] uppercase tracking-wider">Device Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              fetchTransactions();
            }}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === "history" 
                ? "text-blue-600 font-black scale-105" 
                : "text-slate-400 hover:text-slate-600 font-bold"
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[9px] uppercase tracking-wider">Ledger History</span>
          </button>
        </div>
      </div>

      {/* Transaction Details Modal Dialog */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="tx-details-modal">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight uppercase">Audit Record View</h3>
                  <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-black">REF: {selectedTransaction.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 text-xs">
              
              {/* Receipt Visual Header */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 text-center space-y-2">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Transaction Amount</p>
                <h4 className="text-2xl font-black text-slate-950 font-mono">
                  {selectedTransaction.currency.symbol}{selectedTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-500 font-mono">{selectedTransaction.currency.code}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{selectedTransaction.bankName}</span>
                </div>
                
                {/* Status Indicator */}
                <div className="pt-1">
                  {selectedTransaction.status === "successful" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● Successful
                    </span>
                  ) : selectedTransaction.status === "pending" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      ● Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      ● Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Sender & Receiver Ledger Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sender Column */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5">
                  <h5 className="font-black text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Origin (Sender)</h5>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Full Name</p>
                    <p className="font-bold text-slate-800">{selectedTransaction.sender.fullName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Email Address</p>
                    <p className="font-semibold text-slate-700 font-mono break-all">{selectedTransaction.sender.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Routing Code / Account</p>
                    <p className="font-semibold text-slate-600 font-mono">{selectedTransaction.sender.accountNumber || "N/A"}</p>
                  </div>
                </div>

                {/* Receiver Column */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5">
                  <h5 className="font-black text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Destination (Beneficiary)</h5>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Full Name</p>
                    <p className="font-bold text-slate-800">{selectedTransaction.receiver.fullName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Email Address</p>
                    <p className="font-semibold text-slate-700 font-mono break-all">{selectedTransaction.receiver.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Account Number</p>
                    <p className="font-semibold text-slate-600 font-mono">{selectedTransaction.receiver.accountNumber || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Red Box Message if present */}
              {selectedTransaction.receiver.redBoxMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-1">⚠️ Urgent Beneficiary Notification Alert</p>
                  <p className="font-semibold leading-relaxed text-rose-700">{selectedTransaction.receiver.redBoxMessage}</p>
                </div>
              )}

              {/* Dates & Notes */}
              <div className="p-4 border border-slate-150 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Value Date:</span>
                  <span className="font-semibold text-slate-700">{new Date(selectedTransaction.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Template Design:</span>
                  <span className="font-semibold text-slate-700 uppercase tracking-wider font-mono text-[10px]">{selectedTransaction.emailTemplate}</span>
                </div>
                {selectedTransaction.note && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Memo / Description</p>
                    <p className="font-medium text-slate-700 italic">"{selectedTransaction.note}"</p>
                  </div>
                )}
              </div>

              {/* EMAIL MANUAL ALERT RE-DISPATCH CONTROLS */}
              <div className="p-4 bg-blue-50/50 border border-blue-150 rounded-xl space-y-4">
                <h5 className="font-black text-[10px] text-blue-800 uppercase tracking-widest flex items-center gap-1">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Manual Email Dispatch Dispatcher
                </h5>
                
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  Trigger customized transaction receipt notifications manually using the integrated Mailjet API engine.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={resendSender}
                      onChange={(e) => setResendSender(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-slate-700 uppercase">Sender Copy</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={resendReceiver}
                      onChange={(e) => setResendReceiver(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-slate-700 uppercase">Beneficiary Copy</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={resendLoading || (!resendSender && !resendReceiver)}
                  onClick={() => handleResendEmails(selectedTransaction)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/10 cursor-pointer"
                >
                  {resendLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Dispatched Outbox...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Dispatch Selected Alerts
                    </>
                  )}
                </button>

                {resendStatus && (
                  <div className="p-3 bg-white border border-blue-100 rounded-lg text-[10px] font-mono text-slate-700 leading-normal whitespace-pre-line text-left">
                    {resendStatus}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Compact clean footer */}
      <footer className="py-6 border-t border-slate-150 text-center shrink-0 mt-auto">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
          © 2026 GLOBAL TRANSFER PRO SECURE NETWORKS • ALL RIGHTS RESERVED
        </p>
      </footer>
    </div>
  );
}

