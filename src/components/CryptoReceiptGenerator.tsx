import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, Copy, AlertCircle, Printer, XCircle, RefreshCw, Trash2, History, ArrowUpRight,
  Diamond, Zap, Hexagon, Layers, Coins, CircleDot, Cpu, Search, ChevronDown, Building
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SavedReceipt {
  id: string;
  crypto: string;
  amount: string;
  address: string;
  network: string;
  txid: string;
  status: string;
  fee: string;
  date: string;
  type: 'deposit' | 'withdrawal';
  platform: string;
}

const generateRandomTxid = () => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const getNetworkLogo = (networkName: string, sizeClass = "w-5 h-5") => {
  const norm = networkName.trim().toUpperCase();
  
  // Ethereum / ERC20
  if (norm.includes("ETH") || norm.includes("ERC20") || norm.includes("ETHEREUM")) {
    return {
      icon: <Diamond className={`${sizeClass} text-indigo-400 fill-indigo-400/20`} />,
      bgColor: "bg-indigo-500/10",
      textColor: "text-indigo-400",
      label: "Ethereum (ERC20)"
    };
  }
  
  // Tron / TRX
  if (norm.includes("TRX") || norm.includes("TRON") || norm.includes("TRC20")) {
    return {
      icon: <Zap className={`${sizeClass} text-red-500 fill-red-500/20`} />,
      bgColor: "bg-red-500/10",
      textColor: "text-red-400",
      label: "TRON (TRC20)"
    };
  }
  
  // Binance Smart Chain / BNB / BSC / BEP20
  if (norm.includes("BSC") || norm.includes("BNB") || norm.includes("BEP20") || norm.includes("BINANCE")) {
    return {
      icon: <Hexagon className={`${sizeClass} text-amber-400 fill-amber-400/20`} />,
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-400",
      label: "BNB Smart Chain (BEP20)"
    };
  }
  
  // Solana / SOL
  if (norm.includes("SOL") || norm.includes("SOLANA")) {
    return {
      icon: <Cpu className={`${sizeClass} text-teal-400 fill-teal-400/20`} />,
      bgColor: "bg-teal-500/10",
      textColor: "text-teal-400",
      label: "Solana"
    };
  }
  
  // Polygon / MATIC
  if (norm.includes("MATIC") || norm.includes("POLYGON") || norm.includes("POLY")) {
    return {
      icon: <Layers className={`${sizeClass} text-purple-400 fill-purple-400/20`} />,
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-400",
      label: "Polygon"
    };
  }
  
  // Bitcoin / BTC
  if (norm.includes("BTC") || norm.includes("BITCOIN") || norm.includes("BTCB")) {
    return {
      icon: <Coins className={`${sizeClass} text-amber-500 fill-amber-500/20`} />,
      bgColor: "bg-amber-600/10",
      textColor: "text-amber-500",
      label: "Bitcoin"
    };
  }
  
  // Default fallback
  return {
    icon: <CircleDot className={`${sizeClass} text-slate-400`} />,
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    label: networkName
  };
};

const StatusBadge = ({ status }: { status: string }) => {
  let icon = <CheckCircle className="w-5 h-5 fill-[#0ecb81] text-[#181e25]" />;
  let color = "text-[#0ecb81]";
  
  if (status === "Pending") {
    icon = <AlertCircle className="w-5 h-5 fill-[#fcd535] text-[#181e25]" />;
    color = "text-[#fcd535]";
  } else if (status === "Failed") {
    icon = <XCircle className="w-5 h-5 fill-[#f02d3a] text-[#181e25]" />;
    color = "text-[#f02d3a]";
  }
  
  return (
    <div className={`flex items-center justify-center gap-2 mt-4 ${color}`}>
      {icon}
      <span className="text-[20px] font-bold tracking-wide">{status}</span>
    </div>
  );
};

const CRYPTO_CURRENCIES = Array.from(new Set([
  "BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "USDC", "ADA", "AVAX", "DOGE", "TRX", "DOT", "LINK", "MATIC", "LTC", 
  "ATOM", "BCH", "ETC", "XLM", "FIL", "APE", "NEAR", "ALGO", "VET", "SAND", "MANA", "AXS", "EOS", "XTZ", "FTM",
  "CAKE", "KAVA", "GALA", "QNT", "HBAR", "EGLD", "FLOW", "THETA", "TFUEL", "CHZ", "IOTA", "NEO", "KLAY",
  "ICP", "SNX", "GRT", "RNDR", "FET", "AAVE", "MKR", "COMP", "UNI", "SUSHI", "CRV", "DYDX", "LDO", "FXS",
  "PEPE", "SHIB", "FLOKI", "BONK", "WIF", "ORDI", "SATS", "BTT", "JASMY", "RUNE", "APT", "SUI", "IMX", "MINA",
  "GMT", "WOO", "ENJ", "OCEAN", "MASK", "GAL", "CVX", "BADGER", "ZEN", "ZEC", "DASH", "KNC", "STORJ", "SC",
  "HOT", "ONE", "Harmony", "ANKR", "IOTX", "RVN", "CKB", "AR", "BTG", "QTUM", "NEXO", "TRB", "API3", "UMA",
  "BAND", "RLC", "OGN", "AUDIO", "SFP", "TKO", "TLM", "HARD", "DODO", "LIT", "REEF", "XEM", "IOST", "ONT",
  "ONG", "WAVES", "KSM", "NANO", "SYS", "LSK", "DGB", "BTS", "XVG", "STEEM", "BNT", "ICX", "POWR", "GAS"
]));

interface CoinSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const CoinSelector = ({ value, onChange }: CoinSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const filteredCoins = CRYPTO_CURRENCIES.filter(coin => 
    coin.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-all"
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search coins..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border-none pl-9 pr-4 py-2.5 text-sm font-semibold focus:ring-0 placeholder:text-slate-400 rounded-xl"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredCoins.length > 0 ? (
                filteredCoins.map((coin) => (
                  <button
                    key={coin}
                    type="button"
                    onClick={() => {
                      onChange(coin);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center justify-between ${
                      value === coin ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{coin}</span>
                    {value === coin && <CheckCircle className="h-4 w-4" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-slate-400 text-xs font-semibold">
                  No coins found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReceiptDisplay = ({ 
  data, 
  onBack, 
  onSave, 
  isSaved 
}: { 
  data: any; 
  onBack: () => void; 
  onSave: () => void; 
  isSaved: boolean; 
}) => {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const sign = data.type === 'deposit' ? '+' : '-';
  const displayAmount = `${sign}${data.amount} ${data.crypto}`;

  return (
    <div className="fixed inset-0 bg-[#181e25] text-[#eaecef] flex flex-col font-sans z-50 overflow-y-auto print:bg-white print:text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-full {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: white !important;
            color: black !important;
            padding: 40px !important;
          }
        }
      `}</style>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col flex-1 max-w-md mx-auto w-full p-6 pt-12 print-full"
      >
        {/* Amount Header */}
        <div className="text-center mb-10">
          <h1 className="text-[42px] font-bold text-white mb-2 tracking-tight">
            {displayAmount}
          </h1>
          <StatusBadge status={data.status} />
          
          <p className="text-[#848e9c] mt-8 text-[15px] leading-relaxed font-medium px-4">
            {data.type === 'deposit' 
              ? `Crypto has arrived in your ${data.platform} account. View your spot account balance for more details.`
              : `Crypto has been sent from your ${data.platform} account. Please contact the recipient platform for your transaction receipt.`}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-[#2b3139] mb-10"></div>

        {/* Details Table */}
        <div className="space-y-8 text-[16px]">
          <div className="flex justify-between items-center">
            <span className="text-[#848e9c] font-semibold">Network</span>
            <span className="text-white font-bold">{data.network}</span>
          </div>

          <div className="flex justify-between items-start gap-4">
            <span className="text-[#848e9c] font-semibold shrink-0">Address</span>
            <div className="flex items-start gap-2 justify-end">
              <span className="text-white font-bold break-all text-right leading-tight max-w-[240px]">
                {data.address}
              </span>
              <button onClick={() => handleCopy(data.address, "Address")} className="no-print shrink-0 mt-0.5">
                <Copy className="w-5 h-5 text-[#848e9c] hover:text-white" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-start gap-4">
            <span className="text-[#848e9c] font-semibold shrink-0">Txid</span>
            <div className="flex items-start gap-2 justify-end">
              <span className="text-white font-bold break-all text-right leading-tight max-w-[240px] underline decoration-slate-500 underline-offset-4">
                {data.txid}
              </span>
              <button onClick={() => handleCopy(data.txid, "Txid")} className="no-print shrink-0 mt-0.5">
                <Copy className="w-5 h-5 text-[#848e9c] hover:text-white" />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#848e9c] font-semibold">Wallet</span>
            <span className="text-white font-bold">Spot Wallet</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#848e9c] font-semibold">Date</span>
            <span className="text-white font-bold tracking-tight">{data.date}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-16 space-y-4 no-print pb-10">
          {!isSaved ? (
            <button 
              onClick={onSave} 
              className="w-full py-4 bg-[#fcd535] hover:bg-[#f3ba2f] text-slate-900 rounded-xl font-bold transition-all active:scale-[0.98] cursor-pointer"
            >
              Save Receipt to History
            </button>
          ) : (
            <div className="w-full py-4 bg-[#1e2329] border border-[#0ecb81]/30 text-[#0ecb81] rounded-xl font-bold flex items-center justify-center gap-2">
              ✓ Saved to History
            </div>
          )}
          <button 
            onClick={() => window.print()} 
            className="w-full py-4 bg-[#2b3139] hover:bg-[#363e48] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Printer className="w-5 h-5" /> Print / Save PDF
          </button>
          <button 
            onClick={onBack} 
            className="w-full py-4 text-[#848e9c] hover:text-white font-bold transition-all cursor-pointer"
          >
            Back to Editor
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const CryptoReceiptGenerator = () => {
  const [data, setData] = useState({
    crypto: "TRX",
    amount: "23.5",
    address: "THW561B6K743SWkKygAF2675MZkC2nJMZH",
    network: "TRX",
    txid: generateRandomTxid(),
    status: "Completed",
    fee: "1.5",
    date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    type: 'deposit' as 'deposit' | 'withdrawal',
    platform: 'Binance'
  });
  const [generated, setGenerated] = useState(false);
  const [history, setHistory] = useState<SavedReceipt[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('binance_receipt_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Error reading receipt history", e);
      }
    }
  }, []);

  const saveToHistory = () => {
    const newRecord: SavedReceipt = {
      id: data.txid || generateRandomTxid(),
      ...data
    };

    // Prevent duplicates with same txid
    if (history.some(item => item.txid === newRecord.txid)) {
      toast.error("This receipt has already been saved to your history.");
      return;
    }

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('binance_receipt_history', JSON.stringify(updatedHistory));
    toast.success("Receipt saved successfully!");
  };

  const deleteFromHistory = (txid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.txid !== txid);
    setHistory(updatedHistory);
    localStorage.setItem('binance_receipt_history', JSON.stringify(updatedHistory));
    setSelectedIds(prev => prev.filter(id => id !== txid));
    toast.success("Receipt removed from history");
  };

  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear all receipt history?")) {
      setHistory([]);
      setSelectedIds([]);
      localStorage.removeItem('binance_receipt_history');
      toast.success("All history cleared");
    }
  };

  const deleteSelectedHistory = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected receipt(s)?`)) {
      const updatedHistory = history.filter(item => !selectedIds.includes(item.txid));
      setHistory(updatedHistory);
      localStorage.setItem('binance_receipt_history', JSON.stringify(updatedHistory));
      setSelectedIds([]);
      toast.success(`${selectedIds.length} receipt(s) removed from history`);
    }
  };

  const toggleSelect = (txid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(txid) ? prev.filter(id => id !== txid) : [...prev, txid]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === history.length && history.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map(item => item.txid));
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.amount || parseFloat(data.amount) <= 0) {
      toast.error("Please enter a valid transfer amount");
      return;
    }
    if (!data.address) {
      toast.error("Please enter the recipient crypto address");
      return;
    }
    if (!data.network) {
      toast.error("Please enter the network name");
      return;
    }
    if (!data.fee || parseFloat(data.fee) < 0) {
      toast.error("Please enter a valid network fee");
      return;
    }
    setGenerated(true);
  };

  const loadFromHistory = (item: SavedReceipt) => {
    setData({
      crypto: item.crypto,
      amount: item.amount,
      address: item.address,
      network: item.network,
      txid: item.txid,
      status: item.status,
      fee: item.fee,
      date: item.date,
      type: item.type || 'deposit',
      platform: item.platform || 'Binance'
    });
    setGenerated(true);
  };

  const isCurrentSaved = history.some(item => item.txid === data.txid);

  if (generated) {
    return (
      <ReceiptDisplay 
        data={data} 
        onBack={() => setGenerated(false)} 
        onSave={saveToHistory}
        isSaved={isCurrentSaved}
      />
    );
  }

  return (
    <div className="space-y-6 flex-1 flex flex-col justify-start max-w-lg mx-auto w-full animate-fade-in text-left p-2">
      <div className="text-left mb-1 px-1">
        <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">Crypto Receipt Generator</h2>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-black mt-0.5">Generate verified cryptocurrency transaction slips for any platform</p>
      </div>

      <form onSubmit={handleGenerate} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        {/* Receipt Type Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Platform & Receipt Type</label>
          <div className="grid grid-cols-1 gap-3 mb-3">
            <div className="space-y-1.5">
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={data.platform}
                  onChange={(e) => setData({ ...data, platform: e.target.value })}
                  placeholder="Platform Name (e.g. Binance, Coinbase)"
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-3 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "deposit", label: "Deposit (+)", activeBg: "bg-green-600 text-white border-green-600" },
              { id: "withdrawal", label: "Withdrawal (-)", activeBg: "bg-red-600 text-white border-red-600" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setData({ ...data, type: t.id as 'deposit' | 'withdrawal' })}
                className={`py-3 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                  data.type === t.id ? t.activeBg : `bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100`
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cryptocurrency Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cryptocurrency (150+ Coins)</label>
          <CoinSelector 
            value={data.crypto} 
            onChange={(val) => setData({ ...data, crypto: val })} 
          />
        </div>

        {/* Amount Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Transfer Amount</label>
          <div className="relative">
            <input 
              type="number" 
              step="any"
              placeholder="e.g. 23.5" 
              value={data.amount} 
              onChange={e => setData({...data, amount: e.target.value})} 
              className="w-full p-3 pr-16 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-800 text-sm"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 uppercase">
              {data.crypto}
            </span>
          </div>
        </div>

        {/* Address Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Recipient Address</label>
          <input 
            type="text" 
            placeholder="Enter crypto wallet address" 
            value={data.address} 
            onChange={e => setData({...data, address: e.target.value})} 
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-800 text-sm"
            required
          />
        </div>

        {/* Network Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Network Name</label>
          <input 
            type="text" 
            placeholder="e.g. TRX, ERC20, BSC" 
            value={data.network} 
            onChange={e => setData({...data, network: e.target.value})} 
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-800 text-sm"
            required
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {["TRX", "ERC20", "BEP20", "BSC", "SOLANA", "POLYGON", "BTC"].map(net => (
              <button
                key={net}
                type="button"
                onClick={() => setData({ ...data, network: net })}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                  data.network === net 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {net}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction ID (Txid) - Readonly & Generated */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Transaction ID (Txid)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              placeholder="Auto-generated Txid" 
              value={data.txid} 
              className="flex-1 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[11px] select-all outline-none"
            />
            <button 
              type="button" 
              onClick={() => {
                setData(prev => ({ ...prev, txid: generateRandomTxid() }));
                toast.success("New Txid generated!");
              }} 
              className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex items-center gap-1.5 transition-all shrink-0 active:scale-95 cursor-pointer"
              title="Generate random transaction hash"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
        </div>

        {/* Network Fee */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Network Fee</label>
          <div className="relative">
            <input 
              type="number" 
              step="any"
              placeholder="e.g. 1.5" 
              value={data.fee} 
              onChange={e => setData({...data, fee: e.target.value})} 
              className="w-full p-3 pr-16 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-semibold text-slate-800 text-sm"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 uppercase">
              {data.crypto}
            </span>
          </div>
        </div>

        {/* Transaction Status Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Transaction Status</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "Completed", label: "Completed", bg: "bg-[#0ecb81]/10 text-[#0ecb81] border-[#0ecb81]/30", activeBg: "bg-[#0ecb81] text-white border-[#0ecb81]" },
              { id: "Pending", label: "Pending", bg: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", activeBg: "bg-yellow-500 text-slate-900 border-yellow-500" },
              { id: "Failed", label: "Failed", bg: "bg-red-500/10 text-red-500 border-red-500/30", activeBg: "bg-red-500 text-white border-[#f02d3a]" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setData({ ...data, status: st.id })}
                className={`py-3 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                  data.status === st.id ? st.activeBg : `${st.bg} hover:bg-slate-50`
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.99] cursor-pointer"
        >
          Generate Receipt
        </button>
      </form>

      {/* Receipt History Log Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Receipt History List</h3>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-full">
              {history.length}
            </span>
          </div>
          {history.length > 0 && (
            <button 
              type="button"
              onClick={clearAllHistory}
              className="text-xs text-red-500 hover:text-red-700 font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {history.length > 0 && (
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <input 
                type="checkbox"
                checked={selectedIds.length === history.length && history.length > 0}
                onChange={toggleSelectAll}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
              />
              <span>
                {selectedIds.length === history.length ? "Deselect All" : `Select All (${selectedIds.length}/${history.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <button 
                type="button"
                onClick={deleteSelectedHistory}
                className="text-xs text-red-600 hover:text-red-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-red-50 hover:bg-red-100/80 px-2.5 py-1 rounded-lg border border-red-200/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        )}

        {history.length === 0 ? (
          <div className="text-center py-6 text-slate-400 space-y-2">
            <p className="text-xs font-medium">No saved receipts yet.</p>
            <p className="text-[10px] uppercase tracking-wider">Generate a receipt and click the "Save Receipt to History" button inside the view.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {history.map((item) => {
              const isSelected = selectedIds.includes(item.txid);
              const networkLogoInfo = getNetworkLogo(item.network, "w-4 h-4");
              return (
                <div 
                  key={item.txid}
                  onClick={() => loadFromHistory(item)}
                  className={`group flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 border rounded-2xl transition-all cursor-pointer hover:shadow-xs active:scale-[0.99] ${
                    isSelected ? "border-blue-400/80 bg-blue-50/10 shadow-xs" : "border-slate-200/60"
                  }`}
                >
                  {/* Select Checkbox Box */}
                  <div 
                    onClick={(e) => toggleSelect(item.txid, e)}
                    className="p-1 cursor-pointer shrink-0"
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(item.txid, e as any)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                    />
                  </div>

                  {/* Dynamic network visual icon badge inside history list row */}
                  <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${networkLogoInfo.bgColor}`}>
                    {networkLogoInfo.icon}
                  </div>

                  <div className="space-y-1 text-left min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {item.type === 'deposit' ? '+' : '-'}{item.amount} {item.crypto}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                        item.status === "Completed" ? "bg-green-100 text-green-700" :
                        item.status === "Pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate max-w-[170px]">
                      To: {item.address}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {item.date} • {item.network}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                      View <ArrowUpRight className="w-3 h-3" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => deleteFromHistory(item.txid, e)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title="Delete receipt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
