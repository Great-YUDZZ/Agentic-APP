import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  align?: 'left' | 'right';
  direction?: 'down' | 'up';
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  align = 'right',
  direction = 'down',
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const isUp = direction === 'up';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#262626] border border-[#383838] hover:border-[#4a4a4a] text-xs text-[#ececec] transition-colors focus:outline-none focus:border-[#4f4f4f] ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption?.label || value}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#707070] shrink-0 transition-transform duration-150 ${
            isOpen ? (isUp ? '-rotate-180 text-[#ececec]' : 'rotate-180 text-[#ececec]') : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 p-1 rounded-xl bg-[#1e1e1e] border border-[#383838] shadow-2xl min-w-[200px] w-max max-w-xs ${
              isUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } ${align === 'right' ? 'right-0' : 'left-0'} ${dropdownClassName}`}
          >
            <div className="space-y-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[#2a2a2a] text-[#ffffff] font-medium'
                        : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#252525]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-[10px] text-[#707070] font-normal mt-0.5">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#ececec] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
