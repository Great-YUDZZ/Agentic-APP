import React, { useRef } from 'react';
import { TilingNode } from '../../types';
import { TerminalPaneCard } from './TerminalPaneCard';
import { TilingResizer } from './TilingResizer';

interface TilingRendererProps {
  node: TilingNode;
}

export const TilingRenderer: React.FC<TilingRendererProps> = ({ node }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (node.type === 'pane') {
    return <TerminalPaneCard pane={node.data} />;
  }

  const { direction, ratio, first, second, id } = node.data;

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-w-0 min-h-0 relative ${
        direction === 'horizontal' ? 'flex flex-row' : 'flex flex-col'
      }`}
    >
      {/* First Child */}
      <div
        style={
          direction === 'horizontal'
            ? { width: `calc(${ratio * 100}% - 3px)` }
            : { height: `calc(${ratio * 100}% - 3px)` }
        }
        className="min-w-0 min-h-0 flex-shrink-0"
      >
        <TilingRenderer node={first} />
      </div>

      {/* Draggable Divider Handle */}
      <TilingResizer containerId={id} direction={direction} parentRef={containerRef} />

      {/* Second Child */}
      <div
        style={
          direction === 'horizontal'
            ? { width: `calc(${(1 - ratio) * 100}% - 3px)` }
            : { height: `calc(${(1 - ratio) * 100}% - 3px)` }
        }
        className="min-w-0 min-h-0 flex-1"
      >
        <TilingRenderer node={second} />
      </div>
    </div>
  );
};
