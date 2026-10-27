import React, { useCallback } from 'react';
import { SplitDirection } from '../../types';
import { useStore } from '../../store/useStore';

interface TilingResizerProps {
  containerId: string;
  direction: SplitDirection;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

export const TilingResizer: React.FC<TilingResizerProps> = ({
  containerId,
  direction,
  parentRef,
}) => {
  const { updateSplitRatio } = useStore();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const parent = parentRef.current;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        let newRatio: number;
        if (direction === 'horizontal') {
          const offsetX = moveEvent.clientX - rect.left;
          newRatio = offsetX / rect.width;
        } else {
          const offsetY = moveEvent.clientY - rect.top;
          newRatio = offsetY / rect.height;
        }
        updateSplitRatio(containerId, newRatio);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [containerId, direction, parentRef, updateSplitRatio]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`relative flex-shrink-0 z-10 transition-colors group select-none ${
        direction === 'horizontal'
          ? 'w-1.5 cursor-col-resize hover:bg-[#10a37f]/60 bg-[#262626]'
          : 'h-1.5 cursor-row-resize hover:bg-[#10a37f]/60 bg-[#262626]'
      }`}
    >
      <div
        className={`absolute inset-0 m-auto ${
          direction === 'horizontal'
            ? 'w-[1px] h-full bg-[#333333] group-hover:bg-[#10a37f]'
            : 'h-[1px] w-full bg-[#333333] group-hover:bg-[#10a37f]'
        }`}
      />
    </div>
  );
};
