/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Mail, 
  ExternalLink,
  ChevronRight,
  FileText,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  Building,
  Trash2
} from "lucide-react";
import { Transaction, TransactionStatus } from "../types";

interface TransactionDashboardProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onClearHistory: () => void;
}

export default function TransactionDashboard({ transactions, onSelectTransaction, onClearHistory }: TransactionDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search matches
      const matchesSearch = 
        tx.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.sender.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.sender.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.receiver.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.receiver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.id.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, statusFilter]);

  // Helper status renderer
  const renderStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case "successful":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
            ● Successful
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            ● Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
            ● Failed
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-lg overflow-hidden flex flex-col h-full" id="transaction-dashboard">
      {/* Search and Filters Bar */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Bank, Sender, Beneficiary, or Ref ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 rounded-xl text-xs text-slate-900 focus:outline-none transition-all font-semibold"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center space-x-1 border border-slate-200/80 rounded-xl p-1 bg-white self-start md:self-auto shrink-0 shadow-sm">
            {(["all", "successful", "pending", "failed"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest rounded-lg transition-all duration-200 cursor-pointer ${
                  statusFilter === filter
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {filter === "all" ? "ALL RECORDS" : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Records List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-150 max-h-[500px] sm:max-h-none">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => onSelectTransaction(tx)}
              type="button"
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/60 transition-all cursor-pointer group border-none relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
              <div className="flex items-center space-x-4 min-w-0 flex-1 pr-4">
                {/* Logo indicator */}
                <div className="h-12 w-12 rounded-xl border border-slate-200/80 flex items-center justify-center shrink-0 bg-slate-50/40 shadow-sm group-hover:border-slate-300 group-hover:bg-white transition-all">
                  {tx.logoUrl ? (
                    <img src={tx.logoUrl} alt="Bank Logo" className="h-10 w-10 object-contain p-1" />
                  ) : (
                    <Building className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 text-sm truncate uppercase tracking-tight group-hover:text-blue-900 transition-colors">{tx.bankName}</span>
                    <span className="font-mono text-[9px] text-slate-400 font-extrabold tracking-widest">REF: {tx.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-slate-800 truncate">{tx.sender.fullName}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                    <span className="font-semibold text-slate-800 truncate">{tx.receiver.fullName}</span>
                  </div>

                  <div className="flex items-center gap-2.5 mt-2">
                    {renderStatusBadge(tx.status)}
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider font-mono">
                      {new Date(tx.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Amount and Action Indicator */}
              <div className="text-right shrink-0 flex items-center space-x-3 pl-2">
                <div>
                  <div className="text-sm font-black text-slate-900 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
                    {tx.currency.symbol}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">
                    {tx.currency.code}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))
        ) : (
          <div className="py-24 text-center">
            <Building className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">No Transaction Records Found</p>
            <p className="text-xs text-slate-400 mt-1">Try refining your search keyword or selection filters.</p>
          </div>
        )}
      </div>

      {/* Footer statistics summary */}
      <div className="p-4.5 bg-[#0a192f] border-t border-slate-900 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-400 text-[10px] font-black tracking-widest font-mono">TOTAL RECODS: {transactions.length}</span>
        {transactions.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/55 hover:bg-rose-900/70 border border-rose-800/35 text-rose-300 hover:text-rose-200 transition-all rounded-lg text-[9px] font-black tracking-widest cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            CLEAR HISTORY
          </button>
        )}
      </div>
    </div>
  );
}
