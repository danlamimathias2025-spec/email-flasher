/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { Currency } from "../types";
import { ALL_CURRENCIES } from "../utils/currencies";

interface CurrencySelectorProps {
  selectedCurrency: Currency;
  onSelectCurrency: (currency: Currency) => void;
  id?: string;
}

export default function CurrencySelector({
  selectedCurrency,
  onSelectCurrency,
  id,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter and slice items for optimal performance
  const filteredCurrencies = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return ALL_CURRENCIES.slice(0, 100); // return first 100 on idle

    return ALL_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        c.country.toLowerCase().includes(term)
    ).slice(0, 80); // slice to top 80 for outstanding responsive rendering speed
  }, [searchTerm]);

  const handleSelect = (currency: Currency) => {
    onSelectCurrency(currency);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef} id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200/95 rounded-xl shadow-sm text-left focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl" aria-hidden="true">
            {selectedCurrency.symbol || "🪙"}
          </span>
          <div>
            <span className="font-semibold text-gray-900 block leading-tight">
              {selectedCurrency.code}
            </span>
            <span className="text-xs text-gray-500 block">
              {selectedCurrency.name} • {selectedCurrency.country}
            </span>
          </div>
        </div>
        <ChevronDown className="h-5 w-5 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-fade-in-down max-h-[380px] flex flex-col">
          {/* Search bar */}
          <div className="relative p-3 border-b border-gray-50 bg-gray-50">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, currency or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* List items */}
          <ul
            className="overflow-y-auto flex-1 divide-y divide-gray-50 max-h-[300px]"
            role="listbox"
          >
            {filteredCurrencies.length > 0 ? (
              filteredCurrencies.map((c) => {
                const isSelected = c.code === selectedCurrency.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`flex items-center justify-between w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                        isSelected ? "bg-blue-50/50" : ""
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl" aria-hidden="true">
                          {c.symbol}
                        </span>
                        <div>
                          <span className="font-semibold text-gray-900 block text-sm">
                            {c.code}
                          </span>
                          <span className="text-xs text-gray-500 block">
                            {c.name} • {c.country}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="p-4 text-center text-sm text-gray-400 font-medium">
                No matching currencies found
              </li>
            )}
          </ul>
          
          <div className="p-2 border-t border-gray-50 bg-gray-50/50 text-center text-[10px] text-gray-400 font-mono">
            Displaying {filteredCurrencies.length} of {ALL_CURRENCIES.length} options
          </div>
        </div>
      )}
    </div>
  );
}
