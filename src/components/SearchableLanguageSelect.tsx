import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../utils/languages';

interface SearchableLanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchableLanguageSelect: React.FC<SearchableLanguageSelectProps> = ({
  value,
  onChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === value) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter languages based on search query
  const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery(""); // Reset search on open
        }}
        className={`w-full flex items-center justify-between outline-none transition cursor-pointer text-left ${className}`}
      >
        <span className="flex items-center gap-2 truncate">
          <span>{selectedLanguage.name} ({selectedLanguage.code})</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-[9999] animate-fade-in">
          {/* Search Input Box */}
          <div className="p-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <Search className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search language..."
              className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-xs py-1.5 font-bold text-slate-700 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Languages List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === value;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onChange(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-xs font-bold transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{lang.name} ({lang.code})</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-4 text-center text-xs font-bold text-slate-400">
                No matching languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
