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
  ShieldCheck
} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { Transaction } from "./types";
import TransferWizard from "./components/TransferWizard";
import { safeFetchJson } from "./utils/api";

export default function App() {
  const [isLocalMode, setIsLocalMode] = useState(false);

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
      setAccessError("Invalid authorization access key. Please try again.");
    }
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

  const handleTransferSuccess = (newTx: Transaction) => {
    console.log("Secure transfer transaction processed:", newTx.id);
  };

  // ACCESS GATE VIEW
  if (!isAuthorized) {
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

            <div className="border-t border-slate-800/40 my-4" />

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
                Unlock Secure Terminal
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col" id="app-root">
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
        
        <div className="flex items-center gap-3">
          {isLocalMode ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 text-amber-700 text-[9px] font-black rounded-full uppercase tracking-wider">
              <WifiOff className="h-3 w-3" />
              Local Mode Fallback
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[9px] font-black rounded-full uppercase tracking-wider">
              <ShieldCheck className="h-3 w-3" />
              API Connected
            </div>
          )}
        </div>
      </header>

      {/* Centered Workspace Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        <TransferWizard onTransferSuccess={handleTransferSuccess} isLocalMode={isLocalMode} />
      </main>

      {/* Compact clean footer */}
      <footer className="py-6 border-t border-slate-150 text-center shrink-0">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">
          © 2026 GLOBAL TRANSFER PRO SECURE NETWORKS • ALL RIGHTS RESERVED
        </p>
      </footer>
    </div>
  );
}
