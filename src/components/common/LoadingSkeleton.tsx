import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'chat' | 'tree' | 'terminal' | 'line';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 1,
  className = '',
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'chat') {
    return (
      <div className={`space-y-4 w-full p-4 ${className}`}>
        {items.map((key) => (
          <div key={key} className="space-y-3">
            <div className="flex justify-end">
              <div className="w-2/3 max-w-md h-12 bg-[#2f2f2f] rounded-2xl animate-pulse" />
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#2f2f2f] animate-pulse shrink-0" />
              <div className="w-4/5 space-y-2">
                <div className="h-3 bg-[#2f2f2f] rounded-full w-1/4 animate-pulse" />
                <div className="h-16 bg-[#2f2f2f] rounded-2xl animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'tree') {
    return (
      <div className={`p-6 space-y-8 flex flex-col items-center ${className}`}>
        <div className="w-72 h-24 bg-[#2f2f2f] border border-[#383838] rounded-2xl p-4 animate-pulse space-y-2">
          <div className="h-4 bg-[#383838] rounded-full w-1/2" />
          <div className="h-3 bg-[#383838] rounded-full w-3/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
          {[1, 2, 3].map((node) => (
            <div
              key={node}
              className="h-28 bg-[#2f2f2f] border border-[#383838] rounded-2xl p-4 animate-pulse space-y-2"
            >
              <div className="h-4 bg-[#383838] rounded-full w-2/3" />
              <div className="h-3 bg-[#383838] rounded-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'terminal') {
    return (
      <div className={`p-4 font-mono space-y-2 ${className}`}>
        {items.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <div className="w-14 h-3.5 bg-[#2f2f2f] rounded-md animate-pulse shrink-0" />
            <div className="w-20 h-3.5 bg-[#2f2f2f] rounded-md animate-pulse shrink-0" />
            <div className="h-3.5 bg-[#2f2f2f] rounded-md flex-1 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'line') {
    return (
      <div className={`space-y-2 ${className}`}>
        {items.map((key) => (
          <div
            key={key}
            className="h-3 bg-[#2f2f2f] rounded-full animate-pulse"
            style={{ width: `${Math.max(40, 100 - key * 15)}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((key) => (
        <div
          key={key}
          className="p-4 rounded-2xl border border-[#383838] bg-[#2f2f2f] animate-pulse space-y-2.5"
        >
          <div className="h-4 bg-[#383838] rounded-full w-1/3" />
          <div className="h-3 bg-[#383838] rounded-full w-full" />
          <div className="h-1.5 bg-[#383838] rounded-full w-full" />
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
