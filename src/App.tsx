/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import GlobalApexLogo from "./assets/images/global_apex_logo_1784130592412.jpg";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SplashScreen } from "./components/SplashScreen";
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
  CreditCard,
  Shield,
  Fingerprint,
  Globe,
  Sparkles,
  Award,
  Cpu,
  Layers,
  Activity,
  Upload,
  ChevronDown,
  ChevronUp,
  Trash,
  Edit,
  Settings,
  Key,
  Printer
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { Transaction, TransactionStatus } from "./types";
import TransferWizard from "./components/TransferWizard";
import TransactionDashboard from "./components/TransactionDashboard";
import { safeFetchJson, getLocalTransactions, clearLocalTransactions } from "./utils/api";

interface AccessSession {
  email: string;
  code: string;
  activatedAt: number;
  expiresAt: number;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "history" | "email" | "profile" | "admin">("home");

  // Account Authentication State
  const [accountUser, setAccountUser] = useState<any>(() => {
    const stored = localStorage.getItem("account_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Subscription Upload & Status
  const [isSubscriptionDropdownOpen, setIsSubscriptionDropdownOpen] = useState(false);
  const [uploadedReceiptBase64, setUploadedReceiptBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"1-Month" | "6-Months" | "1-Year">("1-Month");

  // Admin Panel states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<"users" | "payments" | "email_template">("users");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editStatus, setEditStatus] = useState("none");
  const [editPlan, setEditPlan] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("");
  const [templateHistory, setTemplateHistory] = useState<string[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  // App Access Gate State
    const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem("user_email") || "";
  });
  
  const [accessError, setAccessError] = useState("");
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
      
  useEffect(() => {
    if (accountUser?.email) {
      setUserEmail(accountUser.email);
    }
  }, [accountUser?.email]);

  
  // Transaction ledger state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Email resending state in detail modal
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSender, setResendSender] = useState(true);
  const [resendReceiver, setResendReceiver] = useState(true);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Session expiry dynamic helper
  const getSessionInfo = () => {
    if (!accountUser) return null;

    // Admin bypass: mathiasdanlami2025@gmail.com has free, lifetime access as admin without subscription
    if (accountUser.email && accountUser.email.trim().toLowerCase() === "mathiasdanlami2025@gmail.com") {
      return {
        session: { email: accountUser.email, activatedAt: Date.now() - 3600 * 1000, expiresAt: Date.now() + 365 * 24 * 3600 * 1000 },
        daysLeft: 999,
        hoursLeft: 0,
        minutesLeft: 0,
        progressPercent: 0,
        durationLabel: "Lifetime Access",
        isExpired: false
      };
    }

    if (accountUser.subscriptionStatus !== "approved" || !accountUser.approvedAt) return null;
    
    const activatedAt = new Date(accountUser.approvedAt).getTime();
    
    let durationMs = 30 * 24 * 60 * 60 * 1000; // default 1 month
    const plan = accountUser.subscriptionPlan || "1-Month";
    if (plan === "6-Months") durationMs = 180 * 24 * 60 * 60 * 1000;
    else if (plan === "1-Year") durationMs = 365 * 24 * 60 * 60 * 1000;
    
    const expiresAt = activatedAt + durationMs;
    const now = Date.now();
    const timeLeftMs = Math.max(0, expiresAt - now);
    
    const daysLeft = Math.floor(timeLeftMs / (24 * 60 * 60 * 1000));
    const hoursLeft = Math.floor((timeLeftMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutesLeft = Math.floor((timeLeftMs % (60 * 60 * 1000)) / (60 * 1000));
    
    const totalDuration = Math.max(1, expiresAt - activatedAt);
    const timeUsed = now - activatedAt;
    const progressPercent = Math.min(100, Math.max(0, (timeUsed / totalDuration) * 100));
    
    const session = { email: accountUser.email, activatedAt, expiresAt };
    
    return {
      session,
      daysLeft,
      hoursLeft,
      minutesLeft,
      progressPercent,
      durationLabel: plan.replace("-", " "),
      isExpired: timeLeftMs <= 0
    };
  };

  const sessionInfo = getSessionInfo();
  const isAuthorized = accountUser && (
    accountUser.email.trim().toLowerCase() === "mathiasdanlami2025@gmail.com" ||
    (accountUser.subscriptionStatus === "approved" && sessionInfo && !sessionInfo.isExpired)
  );

  // --- Account Authentication Handlers ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please enter your email and password.");
      return;
    }
    setAuthError("");
    setIsAuthLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to register account");
      }
      toast.success("Account created successfully!");
      localStorage.setItem("account_user", JSON.stringify(data.user));
      setAccountUser(data.user);
      if (data.user.role === "admin") {
        setActiveTab("admin");
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please enter your email and password.");
      return;
    }
    setAuthError("");
    setIsAuthLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid login credentials");
      }
      toast.success("Logged in successfully!");
      localStorage.setItem("account_user", JSON.stringify(data.user));
      setAccountUser(data.user);
      if (data.user.role === "admin") {
        setActiveTab("admin");
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAccountLogout = () => {
    localStorage.removeItem("account_user");
    localStorage.removeItem("app_access_granted");
    setAccountUser(null);
    toast.success("Logged out from user account");
  };

  const refreshUserStatus = async () => {
    if (!accountUser) return;
    try {
      const response = await fetch("/api/auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountUser.email }),
      });
      const data = await response.json();
      if (response.ok && data.user) {
        localStorage.setItem("account_user", JSON.stringify(data.user));
        setAccountUser(data.user);
        
        }
    } catch (err) {
      console.error("Failed to refresh status:", err);
    }
  };

  // Poll status of user subscription
  useEffect(() => {
    if (accountUser) {
      refreshUserStatus();
      const interval = setInterval(refreshUserStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [accountUser?.email]);

  // Watch for session expiration in real-time to immediately kick out expired users
  useEffect(() => {
    if (accountUser && isAuthorized) {
      const checkExpiry = () => {
        const info = getSessionInfo();
        if (info && info.isExpired) {
          toast.error("Your subscription plan has expired! Please select a plan and submit a payment to regain terminal access.", { id: "sub-expired-toast", duration: 10000 });
          refreshUserStatus();
        }
      };
      const interval = setInterval(checkExpiry, 1000);
      return () => clearInterval(interval);
    }
  }, [accountUser?.email, isAuthorized]);

  // --- Subscription Receipt Upload Handlers ---
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG/JPG/GIF)");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedReceiptBase64(reader.result as string);
      toast.success("Receipt image loaded! Click Confirm to submit.");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const submitPaymentReceipt = async () => {
    if (!uploadedReceiptBase64) {
      toast.error("Please upload a receipt image before submitting.");
      return;
    }
    setIsUploading(true);
    try {
      const response = await fetch("/api/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: accountUser.email,
          receiptImage: uploadedReceiptBase64,
          subscriptionPlan: selectedPlan
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit receipt");
      }
      toast.success("Payment receipt submitted for review! Let your administrator know.");
      await refreshUserStatus();
    } catch (err: any) {
      toast.error(err.message || "An error occurred submitting receipt");
    } finally {
      setIsUploading(false);
    }
  };

  // --- Administrator panel Operations ---
  const fetchAdminUsers = async () => {
    if (!accountUser || accountUser.role !== "admin") return;
    setAdminLoading(true);
    try {
      const response = await fetch("/api/users", {
        headers: { "admin-email": accountUser.email }
      });
      const data = await response.json();
      if (response.ok) {
        setAdminUsers(data);
      } else {
        throw new Error(data.error || "Failed to retrieve accounts");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve accounts");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleApprovePayment = async (userId: string) => {
    try {
      const response = await fetch("/api/payment/approve", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "admin-email": accountUser.email
        },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to approve payment");
      }
      toast.success("Payment verified and subscription activated!");
      fetchAdminUsers();
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const response = await fetch("/api/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin-email": accountUser.email
        },
        body: JSON.stringify({
          userId: editingUser.id,
          password: editPassword,
          role: editRole,
          subscriptionStatus: editStatus,
          subscriptionPlan: editPlan || null
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save user");
      }
      toast.success("Account updated successfully!");
      setShowEditModal(false);
      setEditingUser(null);
      fetchAdminUsers();
    } catch (err: any) {
      toast.error(err.message || "Could not save edits");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin-email": accountUser.email
        },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Account deleted successfully!");
      fetchAdminUsers();
    } catch (err: any) {
      toast.error(err.message || "Could not delete user");
    }
  };

  // Fetch users list when admin view is active
  useEffect(() => {
    if (activeTab === "admin" && accountUser?.role === "admin") {
      fetchAdminUsers();
      if (adminTab === "email_template") {
        fetchEmailTemplate();
      }
    }
  }, [activeTab, accountUser?.role, adminTab]);

  // Autosave
  useEffect(() => {
    if (adminTab === "email_template") {
      const timer = setTimeout(() => {
        localStorage.setItem('emailTemplateDraft', emailTemplate);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [emailTemplate, adminTab]);

  const fetchEmailTemplate = async () => {
    try {
      const response = await fetch("/api/email-template");
      const data = await response.json();
      if (response.ok) {
        const draft = localStorage.getItem('emailTemplateDraft');
        if (draft) {
            setEmailTemplate(draft);
        } else {
            setEmailTemplate(data.html || "");
        }
        fetchTemplateHistory();
      }
    } catch (err) {
      toast.error("Failed to fetch email template");
    }
  };

  const fetchTemplateHistory = async () => {
    try {
        const response = await fetch("/api/email-template/history");
        const data = await response.json();
        if (response.ok) {
            setTemplateHistory(data || []);
        }
    } catch (err) {
        toast.error("Failed to fetch template history");
    }
  };

  const restoreTemplate = async (html: string) => {
    setIsSavingTemplate(true);
    try {
        const response = await fetch("/api/email-template/restore", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "admin-email": accountUser.email
            },
            body: JSON.stringify({ html })
        });
        if (response.ok) {
            setEmailTemplate(html);
            fetchTemplateHistory();
            localStorage.removeItem('emailTemplateDraft');
            toast.success("Template restored!");
        } else {
            throw new Error("Failed to restore template");
        }
    } catch (err: any) {
        toast.error(err.message);
    } finally {
        setIsSavingTemplate(false);
    }
  };

  const resetEmailTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const response = await fetch("/api/email-template/reset", {
        method: "POST",
        headers: { 
          "admin-email": accountUser.email
        }
      });
      if (response.ok) {
        setEmailTemplate("");
        localStorage.removeItem('emailTemplateDraft');
        toast.success("Template reset to default!");
      } else {
        throw new Error("Failed to reset template");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const saveEmailTemplate = async () => {
    // Validation
    const requiredPlaceholders = ["{{bank_logo_image}}"];
    const missing = requiredPlaceholders.filter(p => !emailTemplate.includes(p));
    if (missing.length > 0) {
      toast.error(`Missing required placeholders: ${missing.join(", ")}`);
      return;
    }

    setIsSavingTemplate(true);
    try {
      const response = await fetch("/api/email-template", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "admin-email": accountUser.email
        },
        body: JSON.stringify({ html: emailTemplate })
      });
      if (response.ok) {
        localStorage.removeItem('emailTemplateDraft');
        toast.success("Template saved!");
      } else {
        throw new Error("Failed to save template");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Watch for session expiration in real-time
  useEffect(() => {
    if (isAuthorized) {
      const checkExpiry = () => {
        const info = getSessionInfo();
        if (info && info.isExpired) {
          toast.error("Your system access authorization period has expired.", { duration: 6000 });
        }
      };
      
      checkExpiry();
      const interval = setInterval(checkExpiry, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized, accountUser]);

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

  // Scroll tracking state to hide/show floating bottom dock
  const [isNavVisible, setIsNavVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let scrollTimeout: any = null;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide the nav dock during any scroll event (downward or upward)
      if (Math.abs(currentScrollY - lastScrollY) > 5) {
        setIsNavVisible(false);
      }
      
      lastScrollY = currentScrollY;

      // Clear the previous timeout and schedule showing the dock again when scrolling stops
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      scrollTimeout = setTimeout(() => {
        setIsNavVisible(true);
      }, 250); // Show dock 250ms after scrolling stops
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

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
      const senderEmailToUse = localStorage.getItem("mailjet_sender_email") || accountUser?.email || "danlamimathias2025@gmail.com";
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
  // 1. Account registration & login gate (MUST happen first!)
  if (!accountUser) {
    return (
      <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans relative overflow-hidden" id="account-gate">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden relative z-10"
        >
          {/* Glowing top line */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 bg-blue-950/20 border border-blue-800/50 rounded-2xl flex items-center justify-center shadow-lg mb-1 overflow-hidden">
                <img src={GlobalApexLogo} alt="Global Apex Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase font-sans">
                GLOBAL PLATFORM ACCOUNT
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
                {authTab === "login" ? "Sign In to Secure Account" : "Create Operator Account"}
              </p>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 bg-slate-950 border border-slate-800/60 p-1 rounded-xl font-mono">
              <button
                type="button"
                onClick={() => { setAuthTab("login"); setAuthError(""); }}
                className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${authTab === "login" ? "bg-slate-850 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab("register"); setAuthError(""); }}
                className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${authTab === "register" ? "bg-slate-850 text-white shadow" : "text-slate-400 hover:text-white"}`}
              >
                Register
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs font-bold text-center">
                {authError}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={authTab === "login" ? handleLogin : handleRegister} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="operator@globalbank.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  PASSWORD
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-700 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAuthLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : authTab === "login" ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    SIGN IN TO ACCOUNT
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    CREATE NEW ACCOUNT
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
        
        <p className="text-[9px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
          © 2026 GLOBAL SECURE NETWORKS GROUP
        </p>
      </div>
    );
  }

  // 2. Terminal Authorized Access code gate (checks if they have unlocked terminal using their copied approved subscription code)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col justify-start items-center px-4 py-8 font-sans relative overflow-y-auto" id="access-gate">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

        {/* Floating User Account Header Bar */}
        <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/60 px-4 py-3 rounded-2xl mb-6 relative z-10">
          <div className="flex items-center gap-2 text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/30 flex items-center justify-center font-bold text-xs text-blue-400">
              {accountUser.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Logged in operator</p>
              <p className="text-xs font-bold text-slate-200">{accountUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAccountLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>

        <div className="w-full max-w-2xl mx-auto space-y-6 relative z-10">
          {/* LEFT SIDE: Subscription Preview Box */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-6 text-left">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[8px] bg-indigo-950 text-indigo-400 border border-indigo-800/60 px-2 py-0.5 rounded-full font-black uppercase tracking-widest font-mono">
                    EXECUTIVE PLAN
                  </span>
                  <h3 className="text-lg font-black text-white mt-1 uppercase">Choose Subscription Plan</h3>
                  <p className="text-xs text-slate-400">Full unlimited access to the secure transfer terminal, active ledger tracking, and automated SMTP integrations.</p>
                </div>
                <div className="p-3 bg-blue-950/40 text-blue-400 border border-blue-800/30 rounded-2xl">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>

              {/* Plan Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("1-Month")}
                  className={`p-4 rounded-2xl border text-left transition-all ${selectedPlan === "1-Month" ? "bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "bg-slate-950 border-slate-800/80 hover:border-slate-700"}`}
                >
                  <p className={`text-xs font-black uppercase tracking-wider ${selectedPlan === "1-Month" ? "text-blue-400" : "text-slate-400"}`}>1 Month</p>
                  <p className="text-[10px] text-slate-500 mt-1">Short-term access</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("6-Months")}
                  className={`p-4 rounded-2xl border text-left transition-all ${selectedPlan === "6-Months" ? "bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "bg-slate-950 border-slate-800/80 hover:border-slate-700"}`}
                >
                  <p className={`text-xs font-black uppercase tracking-wider ${selectedPlan === "6-Months" ? "text-blue-400" : "text-slate-400"}`}>6 Months</p>
                  <p className="text-[10px] text-slate-500 mt-1">Standard period</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("1-Year")}
                  className={`p-4 rounded-2xl border text-left transition-all ${selectedPlan === "1-Year" ? "bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "bg-slate-950 border-slate-800/80 hover:border-slate-700"}`}
                >
                  <p className={`text-xs font-black uppercase tracking-wider ${selectedPlan === "1-Year" ? "text-blue-400" : "text-slate-400"}`}>1 Year</p>
                  <p className="text-[10px] text-slate-500 mt-1">Best value</p>
                </button>
              </div>

              {/* Price Tag & Paystack Link */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pricing Plan</p>
                  <p className="text-xl font-black text-white font-mono uppercase tracking-wide">
                    {selectedPlan === "1-Month" && "1 Month Plan"}
                    {selectedPlan === "6-Months" && "6 Months Plan"}
                    {selectedPlan === "1-Year" && "1 Year Plan"}
                  </p>
                </div>
                <a
                  href={
                    selectedPlan === "1-Month" ? "https://paystack.shop/pay/globalapex1" :
                    selectedPlan === "6-Months" ? "https://paystack.shop/pay/globalapex6" :
                    "https://paystack.shop/pay/globalapex"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-950/50"
                >
                  Pay via Paystack
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* Collapsible Dropdown: Upload Transaction Receipt Image */}
              <div className="bg-slate-950 border border-slate-800/60 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsSubscriptionDropdownOpen(!isSubscriptionDropdownOpen)}
                  className="w-full flex items-center justify-between p-4 font-bold text-xs uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-900/30 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-indigo-400" />
                    Upload Transaction Receipt Image
                  </span>
                  {isSubscriptionDropdownOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </button>

                <AnimatePresence>
                  {isSubscriptionDropdownOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="border-t border-slate-800/60 overflow-hidden"
                    >
                      <div className="p-4 space-y-4">
                        <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center hover:bg-slate-900/10 transition-colors relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer animate-pulse"
                          />
                          <div className="space-y-2 pointer-events-none">
                            <Upload className="mx-auto h-6 w-6 text-slate-500 animate-bounce" />
                            <p className="text-xs font-semibold text-slate-300">Choose receipt file or drag here</p>
                            <p className="text-[10px] text-slate-500">Supports PNG, JPG, GIF image file formats</p>
                          </div>
                        </div>

                        {uploadedReceiptBase64 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loaded Receipt Preview</p>
                            <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 max-h-48 flex items-center justify-center">
                              <img src={uploadedReceiptBase64} alt="Receipt Preview" className="max-h-48 object-contain" />
                              <button
                                type="button"
                                onClick={() => setUploadedReceiptBase64(null)}
                                className="absolute top-2 right-2 p-1.5 bg-rose-500/80 hover:bg-rose-600 rounded-lg text-white cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={submitPaymentReceipt}
                              disabled={isUploading}
                              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                              {isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Confirm & Submit Receipt"}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dynamic Subscription Status Alert */}
              {accountUser.subscriptionStatus === "none" && (
                <div className="p-4 bg-slate-950 border border-blue-500/15 rounded-2xl text-xs space-y-1">
                  <p className="font-bold uppercase text-[9px] tracking-wider text-blue-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Subscription Required
                  </p>
                  <p className="text-slate-400 leading-relaxed">No active receipt has been submitted. Please tap Pay via Paystack, complete your checkout, upload your transaction receipt in the dropdown box, and click Confirm to submit.</p>
                </div>
              )}

              {accountUser.subscriptionStatus === "pending" && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs space-y-2">
                  <p className="font-bold uppercase text-[9px] tracking-wider text-amber-400 flex items-center gap-1.5 animate-pulse">
                    <Clock className="h-3.5 w-3.5" />
                    Verification Pending Approval
                  </p>
                  <p className="text-slate-400 leading-relaxed">Your transaction receipt has been submitted to the executive billing desk. The system is auto-refreshing; you will automatically be granted access to the terminal once verified.</p>
                  {accountUser.receiptImage && (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-2 max-w-[140px] mt-2">
                      <p className="text-[8px] font-mono text-slate-500 uppercase mb-1">Submitted Image</p>
                      <img src={accountUser.receiptImage} alt="Submitted Receipt" className="max-h-20 mx-auto object-contain" />
                    </div>
                  )}
                </div>
              )}

              {(accountUser.subscriptionStatus === "expired" || (accountUser.subscriptionStatus === "approved" && !isAuthorized)) && (
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-xs space-y-3">
                  <p className="font-bold uppercase text-[9px] tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Subscription Expired
                  </p>
                  <p className="text-slate-300 leading-relaxed">Your previous {accountUser.subscriptionPlan || "1-Month"} subscription has expired. Please select a plan and submit a new payment receipt to regain access.</p>
                </div>
              )}

            </div>
          </div>

                  </div>

        {/* Security Compliance Trust Seals Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-4 text-[9px] text-slate-500 font-mono uppercase tracking-widest font-black relative z-10"
        >
          <div className="flex items-center gap-1 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800/50">
            <Shield className="h-3 w-3 text-emerald-500" />
            <span>AES-256 ENCRYPTED</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800/50">
            <Cpu className="h-3 w-3 text-blue-500" />
            <span>ISO 27001 SECURE</span>
          </div>
        </motion.div>

        <p className="text-[9px] text-slate-600 mt-6 uppercase tracking-widest font-bold relative z-10">
          © 2026 GLOBAL SECURE NETWORKS GROUP
        </p>
      </div>
    );
  }

  // CORE WORKSPACE VIEW
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col pb-20" id="app-root">
      <AnimatePresence>
        {showSplash ? (
          <SplashScreen logo={GlobalApexLogo} onComplete={() => setShowSplash(false)} />
        ) : null}
      </AnimatePresence>
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
      <header className="h-16 mt-4 mx-4 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-sm flex items-center justify-between px-6 sticky top-4 z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-950/20 border border-blue-800/50 rounded-lg flex items-center justify-center shadow-md overflow-hidden">
            <img src={GlobalApexLogo} alt="Global Apex Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-slate-900 leading-none uppercase">GLOBAL APEX</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status - simplified to fit */}
          {isLocalMode ? (
            <div className="px-2 py-0.5 bg-amber-50 border border-amber-200/80 text-amber-700 text-[8px] font-black rounded-full uppercase">
              Local
            </div>
          ) : (
            <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[8px] font-black rounded-full uppercase">
              API
            </div>
          )}

          <button 
            onClick={handleAccountLogout}
            title="Logout"
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
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
        ) : activeTab === "email" ? (
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
        ) : activeTab === "profile" ? (
          <div className="space-y-6 flex-1 flex flex-col justify-start max-w-md mx-auto w-full animate-fade-in">
            <div className="text-left mb-1 px-1">
              <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">System Access Profile</h2>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Track your secure terminal subscription period</p>
            </div>

            {(() => {
              const info = getSessionInfo();
              if (!info) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
                    <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">No active access session found</p>
                    <button
                      onClick={handleAccountLogout}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                    >
                      Log In Securely
                    </button>
                  </div>
                );
              }

              const { session, daysLeft, hoursLeft, minutesLeft, progressPercent, durationLabel, isExpired } = info;
              return (
                <div className="space-y-5">
                  {/* Primary Profile Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-950 text-white border-2 border-blue-800 rounded-2xl flex items-center justify-center font-black text-2xl uppercase shadow-md select-none shrink-0">
                        {session.email.trim().charAt(0)}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Terminal Account</span>
                          <span className={`inline-block w-2 h-2 rounded-full ${isExpired ? "bg-rose-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`} />
                          <span className={`text-[8px] font-black uppercase ${isExpired ? "text-rose-500" : "text-emerald-500"}`}>
                            {isExpired ? "Expired" : "Authorized"}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 font-mono truncate" title={session.email}>
                          {session.email}
                        </h3>
                      </div>
                    </div>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-100"></div>
                      <span className="flex-shrink mx-3 text-[8px] text-slate-400 uppercase tracking-widest font-black">Subscription Status</span>
                      <div className="flex-grow border-t border-slate-100"></div>
                    </div>

                    {/* Subscription Progress Bar */}
                    <div className="space-y-2 text-left">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-black uppercase tracking-wider">Access Elapsed</span>
                        <span className="text-slate-700 font-bold uppercase font-mono">{Math.round(progressPercent)}% Used</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/40">
                        <div 
                          className={`h-full transition-all duration-500 ${isExpired ? "bg-rose-500" : progressPercent > 80 ? "bg-amber-500" : "bg-blue-600"}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Time Remaining Indicator */}
                    <div className={`p-4 rounded-xl border flex items-center gap-3.5 text-left ${isExpired ? "bg-rose-50/50 border-rose-150 text-rose-800" : "bg-blue-50/50 border-blue-150 text-blue-900"}`}>
                      <Clock className={`h-5 w-5 shrink-0 ${isExpired ? "text-rose-500" : "text-blue-500"}`} />
                      <div>
                        <span className="block text-[8px] font-black uppercase tracking-wider opacity-85">Time Left on License</span>
                        <span className="text-xs font-black uppercase tracking-wide">
                          {isExpired ? (
                            "License Period Expired"
                          ) : (
                            `${daysLeft} Days, ${hoursLeft} Hours, ${minutesLeft} Mins`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Meta Fields Grid */}
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                      <div className="space-y-1 text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Access Code</span>
                        <code className="block text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg">
                          ••••••
                        </code>
                      </div>

                      <div className="space-y-1 text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Plan Duration</span>
                        <span className="block text-xs font-black text-slate-800 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-lg">
                          {durationLabel}
                        </span>
                      </div>

                      <div className="space-y-1 text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Activated On</span>
                        <span className="block text-xs font-semibold text-slate-600 font-mono">
                          {new Date(session.activatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </span>
                      </div>

                      <div className="space-y-1 text-left">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Expires On</span>
                        <span className="block text-xs font-bold text-slate-700 font-mono">
                          {new Date(session.expiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Renew support billing desk */}
                  <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 space-y-4">
                    <div className="text-left space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">Need to Extend System Access?</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                        Renew, upgrade, or add device authorizations on your subscription by contacting our secure billing desk directly.
                      </p>
                    </div>

                    <a
                      href="https://wa.me/2348082076038"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Contact Secure Desk
                    </a>
                  </div>

                  {accountUser?.role === "admin" && (
                    <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 space-y-4">
                      <div className="text-left space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">Executive Administration</h4>
                        <p className="text-[10px] text-blue-600/80 leading-relaxed font-semibold">
                          Access the secure management panel to oversee users, credentials, and subscriptions.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("admin")}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        Open Admin Panel
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : activeTab === "admin" && accountUser?.role === "admin" ? (
          /* Admin Panel View */
          <div className="space-y-6 flex-1 flex flex-col justify-start max-w-4xl mx-auto w-full animate-fade-in text-left">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">Executive Administration</h2>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-0.5">Manage operator accounts, billing, and credentials</p>
              </div>
              <button
                type="button"
                onClick={fetchAdminUsers}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-600 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${adminLoading ? "animate-spin" : ""}`} />
                Refresh List
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="grid grid-cols-3 bg-white border border-slate-200 p-1 rounded-2xl max-w-lg font-mono">
              <button
                type="button"
                onClick={() => setAdminTab("users")}
                className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${adminTab === "users" ? "bg-slate-900 text-white shadow-sm" : "text-slate-450 hover:text-slate-900"}`}
              >
                Operators ({adminUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("payments")}
                className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${adminTab === "payments" ? "bg-slate-900 text-white shadow-sm" : "text-slate-450 hover:text-slate-900"}`}
              >
                Pending Payments ({adminUsers.filter(u => u.subscriptionStatus === "pending").length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab("email_template")}
                className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${adminTab === "email_template" ? "bg-slate-900 text-white shadow-sm" : "text-slate-450 hover:text-slate-900"}`}
              >
                Email Template
              </button>
            </div>

            {adminLoading && adminUsers.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
                <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Syncing accounts database...</p>
              </div>
            ) : adminTab === "email_template" ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Email HTML Template</h4>
                
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Placeholders (Click to insert):</p>
                  <div className="flex flex-wrap gap-2">
                    {["{{sender_name}}", "{{amount}}", "{{bank_logo_image}}", "{{transaction_ref}}", "{{date}}"].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          const textarea = templateTextareaRef.current;
                          if (!textarea) return;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = emailTemplate;
                          const newText = text.substring(0, start) + p + text.substring(end);
                          setEmailTemplate(newText);
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + p.length, start + p.length);
                          }, 0);
                        }}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Upload Bank Logo:</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          try {
                            const res = await fetch("/api/upload-logo", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ base64 })
                            });
                            if (res.ok) {
                              toast.success("Logo uploaded!");
                              // Insert placeholder if not present
                              if (!emailTemplate.includes("{{bank_logo_image}}")) {
                                const textarea = templateTextareaRef.current;
                                if (textarea) {
                                  const start = textarea.selectionStart;
                                  const newText = emailTemplate.substring(0, start) + "{{bank_logo_image}}" + emailTemplate.substring(start);
                                  setEmailTemplate(newText);
                                } else {
                                  setEmailTemplate(emailTemplate + "{{bank_logo_image}}");
                                }
                              }
                            } else {
                              toast.error("Upload failed");
                            }
                          } catch (err) {
                            toast.error("Upload error");
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>

                <textarea
                  ref={templateTextareaRef}
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  className="w-full h-96 bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs"
                  placeholder="Enter HTML template here..."
                />
                <button
                  onClick={saveEmailTemplate}
                  disabled={isSavingTemplate}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest"
                >
                  {isSavingTemplate ? "Saving..." : "Save Template"}
                </button>
                <button
                  onClick={resetEmailTemplate}
                  disabled={isSavingTemplate}
                  className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black uppercase tracking-widest"
                >
                  Reset to Default
                </button>
                
                {templateHistory.length > 0 && (
                  <div className="space-y-2 mt-6 border-t border-slate-200 pt-6">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Version History</h4>
                    <div className="space-y-2">
                        {templateHistory.map((h, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-mono text-slate-500">Version {templateHistory.length - i}</span>
                                <button
                                    onClick={() => restoreTemplate(h)}
                                    className="px-3 py-1 bg-white hover:bg-slate-100 text-blue-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors"
                                >
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : adminTab === "users" ? (
              /* Users Management List */
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-mono">
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">Operator Info</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">Subscription Status</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">Access Code</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-medium uppercase">
                            No operator accounts registered on database.
                          </td>
                        </tr>
                      ) : (
                        adminUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-800">{user.email}</p>
                              <p className="text-[9px] text-slate-400 font-mono">ID: {user.id}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider font-mono ${user.role === "admin" ? "bg-rose-50 text-rose-600 border border-rose-150" : "bg-slate-100 text-slate-600 border border-slate-200/50"}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider font-mono ${user.subscriptionStatus === "approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-150" : user.subscriptionStatus === "pending" ? "bg-amber-50 text-amber-600 border border-amber-150 animate-pulse" : "bg-slate-100 text-slate-500 border border-slate-200/50"}`}>
                                {user.subscriptionStatus || "none"}
                              </span>
                            </td>
                                                        <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditPassword("");
                                    setEditRole(user.role || "user");
                                    setEditStatus(user.subscriptionStatus || "none");
                                    setEditPlan(user.subscriptionPlan || "");
                                    setShowEditModal(true);
                                  }}
                                  className="p-1.5 hover:bg-slate-150/80 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                  title="Edit User Account"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={user.email === accountUser.email}
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors cursor-pointer"
                                  title="Delete User Account"
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Payment Approvals list */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {adminUsers.filter(u => u.subscriptionStatus === "pending").length === 0 ? (
                  <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">All pending payments verified & up-to-date!</p>
                  </div>
                ) : (
                  adminUsers.filter(u => u.subscriptionStatus === "pending").map((user) => (
                    <div key={user.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{user.email}</p>
                          <p className="text-[9px] text-slate-400 font-mono">ID: {user.id}</p>
                          {user.subscriptionPlan && (
                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mt-1 border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block">
                              Plan: {user.subscriptionPlan}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider font-mono bg-amber-50 text-amber-600 border border-amber-150 animate-pulse">
                          Needs Approval
                        </span>
                      </div>

                      {user.receiptImage && (
                        <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center max-h-56 p-2">
                          <img src={user.receiptImage} alt="Uploaded receipt" className="max-h-48 object-contain" />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleApprovePayment(user.id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        Approve Payment Request
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Restrained / Unknown Tab</p>
          </div>
        )}
      </main>

      {/* Persistent Floating Bottom Dock */}
      <AnimatePresence>
        {isNavVisible && (
          <motion.div 
            initial={{ y: 100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-5 inset-x-4 z-40 shrink-0"
          >
            <div className="max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.1)] py-2 px-4 flex items-center justify-around">
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-300 relative cursor-pointer ${
                  activeTab === "home" 
                    ? "text-blue-600 font-extrabold scale-105" 
                    : "text-slate-400 hover:text-slate-600 font-bold hover:scale-102"
                }`}
              >
                <Home className="h-5 w-5 stroke-[2]" />
                <span className="text-[9px] uppercase tracking-wider font-sans">New Transfer</span>
                {activeTab === "home" && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="absolute -bottom-1 w-5 h-0.75 bg-blue-600 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("email")}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-300 relative cursor-pointer ${
                  activeTab === "email" 
                    ? "text-blue-600 font-extrabold scale-105" 
                    : "text-slate-400 hover:text-slate-600 font-bold hover:scale-102"
                }`}
              >
                <Mail className="h-5 w-5 stroke-[2]" />
                <span className="text-[9px] uppercase tracking-wider font-sans">Device Email</span>
                {activeTab === "email" && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="absolute -bottom-1 w-5 h-0.75 bg-blue-600 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("history");
                  fetchTransactions();
                }}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-300 relative cursor-pointer ${
                  activeTab === "history" 
                    ? "text-blue-600 font-extrabold scale-105" 
                    : "text-slate-400 hover:text-slate-600 font-bold hover:scale-102"
                }`}
              >
                <FileText className="h-5 w-5 stroke-[2]" />
                <span className="text-[9px] uppercase tracking-wider font-sans">Ledger History</span>
                {activeTab === "history" && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="absolute -bottom-1 w-5 h-0.75 bg-blue-600 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-300 relative cursor-pointer ${
                  activeTab === "profile" 
                    ? "text-blue-600 font-extrabold scale-105" 
                    : "text-slate-400 hover:text-slate-600 font-bold hover:scale-102"
                }`}
              >
                <User className="h-5 w-5 stroke-[2]" />
                <span className="text-[9px] uppercase tracking-wider font-sans">My Profile</span>
                {activeTab === "profile" && (
                  <motion.div 
                    layoutId="activeTabIndicator" 
                    className="absolute -bottom-1 w-5 h-0.75 bg-blue-600 rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operator Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="edit-user-modal">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto text-left">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings className="h-5 w-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight uppercase">Edit Operator Profile</h3>
                  <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest font-black">ID: {editingUser.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Email Address
                </label>
                <p className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl">
                  {editingUser.email}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all placeholder:text-slate-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Role Privilege
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-850 rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all"
                  >
                    <option value="user">User Operator</option>
                    <option value="admin">Executive Admin</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Subscription Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-850 rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all"
                  >
                    <option value="none">None (Locked)</option>
                    <option value="pending">Pending Receipt</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Subscription Plan
                </label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-850 rounded-xl px-3 py-2.5 text-xs focus:outline-none transition-all font-bold"
                >
                  <option value="">No Plan</option>
                  <option value="1-Month">1 Month</option>
                  <option value="6-Months">6 Months</option>
                  <option value="1-Year">1 Year</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Print Receipt"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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

