import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto select-none ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec] mb-4">
        <Icon className="w-5 h-5" />
      </div>

      <h3 className="text-sm font-semibold text-[#ececec] mb-1">{title}</h3>
      <p className="text-xs text-[#b4b4b4] mb-5 leading-relaxed">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2.5">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-[#ececec] hover:bg-white text-black transition-colors"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-[#212121] hover:bg-[#282828] text-[#ececec] border border-[#303030] transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
