import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  X,
  Search,
  Sliders,
  RotateCcw,
  Tag,
  Link,
  FileText,
} from 'lucide-react';
import * as d3 from 'd3';
import { useStore } from '../../store/useStore';
import { GraphNodeItem, GraphSnapshot } from '../../types';

interface D3Node extends d3.SimulationNodeDatum, GraphNodeItem {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: D3Node | string;
  target: D3Node | string;
}

export const GraphViewModal: React.FC<{
  isEmbedded?: boolean;
  onOpenNote?: (title: string) => void;
}> = ({ isEmbedded = false, onOpenNote }) => {
  const { isGraphViewModalOpen, setGraphViewModalOpen, getGraphSnapshot, addToast } = useStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{ node: GraphNodeItem; x: number; y: number } | null>(null);

  // Graph Simulation Tunings
  const [nodeRadiusMultiplier, setNodeRadiusMultiplier] = useState(1.5);
  const [linkDistance, setLinkDistance] = useState(90);
  const [chargeStrength, setChargeStrength] = useState(-220);
  const [showAllLabels, setShowAllLabels] = useState(false);

  useEffect(() => {
    if (isGraphViewModalOpen || isEmbedded) {
      loadGraph();
    }
  }, [isGraphViewModalOpen, isEmbedded]);

  const loadGraph = async () => {
    const data = await getGraphSnapshot();
    if (data) {
      setSnapshot(data);
    }
  };

  useEffect(() => {
    if ((!isGraphViewModalOpen && !isEmbedded) || !snapshot || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { clientWidth: width, clientHeight: height } = containerRef.current;

    // Filter nodes based on search
    const activeNodes: D3Node[] = snapshot.nodes
      .filter((n) =>
        searchFilter === '' ||
        n.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        n.tags.some((t) => t.toLowerCase().includes(searchFilter.toLowerCase()))
      )
      .map((n) => ({ ...n }));

    const nodeIds = new Set(activeNodes.map((n) => n.id));

    const activeLinks: D3Link[] = snapshot.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    // Container group for Pan & Zoom
    const g = svg.append('g').attr('class', 'graph-container');

    // Setup Zoom
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4.0])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);

    // Initial centering
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.9));

    // Force Simulation
    const simulation = d3
      .forceSimulation<D3Node>(activeNodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(activeLinks)
          .id((d: D3Node) => d.id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide<D3Node>().radius((d) => 8 + (d.backlink_count || 0) * 3))
      .alphaDecay(0.025);

    // Render Edges
    const linkSelection = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, D3Link>('line')
      .data(activeLinks)
      .enter()
      .append('line')
      .attr('stroke', '#3a3a3a')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.65);

    // Drag behavior for nodes
    const dragBehavior = d3
      .drag<SVGGElement, D3Node>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Render Nodes
    const nodeSelection = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, D3Node>('g')
      .data(activeNodes)
      .enter()
      .append('g')
      .attr('class', 'node-group cursor-pointer')
      .call(dragBehavior as any);

    // Node Circle
    nodeSelection
      .append('circle')
      .attr('r', (d: D3Node) => Math.min(24, Math.max(5, 5 + (d.backlink_count || 0) * nodeRadiusMultiplier)))
      .attr('fill', (d: D3Node) => {
        if (d.backlink_count >= 3) return '#3b82f6'; // Hub note
        if (d.tags.length > 0) return '#10b981';     // Categorized note
        return '#8b5cf6';                            // Standard note
      })
      .attr('stroke', '#1f1f1f')
      .attr('stroke-width', 1.5)
      .attr('class', 'transition-opacity duration-150');

    // Node Text Label
    const textSelection = nodeSelection
      .append('text')
      .text((d: D3Node) => d.title)
      .attr('x', (d: D3Node) => Math.min(24, Math.max(5, 5 + (d.backlink_count || 0) * nodeRadiusMultiplier)) + 4)
      .attr('y', 3.5)
      .attr('fill', '#ececec')
      .attr('font-size', '10px')
      .attr('font-family', 'sans-serif')
      .attr('font-weight', '500')
      .attr('opacity', showAllLabels ? 0.9 : 0)
      .attr('class', 'pointer-events-none transition-opacity duration-150');

    // Interactive Hover & Highlight logic (Obsidian style)
    const connectedMap: Record<string, Set<string>> = {};
    activeNodes.forEach((n) => {
      connectedMap[n.id] = new Set([n.id]);
    });
    activeLinks.forEach((l) => {
      const srcId = typeof l.source === 'object' ? (l.source as D3Node).id : String(l.source);
      const tgtId = typeof l.target === 'object' ? (l.target as D3Node).id : String(l.target);
      connectedMap[srcId]?.add(tgtId);
      connectedMap[tgtId]?.add(srcId);
    });

    nodeSelection
      .on('mouseenter', (event: MouseEvent, d: D3Node) => {
        const neighbors = connectedMap[d.id] || new Set([d.id]);

        // Dim unconnected nodes
        nodeSelection.style('opacity', (n: D3Node) => (neighbors.has(n.id) ? 1 : 0.12));

        // Dim unconnected links
        linkSelection
          .style('opacity', (l: any) => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return sId === d.id || tId === d.id ? 1 : 0.05;
          })
          .attr('stroke', (l: any) => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return sId === d.id || tId === d.id ? '#60a5fa' : '#3a3a3a';
          });

        // Always show label on hover
        textSelection.style('opacity', (n: D3Node) => (neighbors.has(n.id) ? 1 : showAllLabels ? 0.1 : 0));

        // Tooltip
        const [mx, my] = d3.pointer(event, containerRef.current);
        setHoveredNode({ node: d, x: mx, y: my });
      })
      .on('mouseleave', () => {
        nodeSelection.style('opacity', 1);
        linkSelection.style('opacity', 0.65).attr('stroke', '#3a3a3a');
        textSelection.style('opacity', showAllLabels ? 0.9 : 0);
        setHoveredNode(null);
      })
      .on('click', (_event: MouseEvent, d: D3Node) => {
        if (onOpenNote) {
          onOpenNote(d.title);
          setGraphViewModalOpen(false);
        } else {
          addToast('info', `Note terpilih: ${d.title}.md`);
        }
      });

    // Tick Animation Loop
    simulation.on('tick', () => {
      linkSelection
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeSelection.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [
    isGraphViewModalOpen,
    isEmbedded,
    snapshot,
    searchFilter,
    nodeRadiusMultiplier,
    linkDistance,
    chargeStrength,
    showAllLabels,
  ]);

  if (!isGraphViewModalOpen && !isEmbedded) return null;

  const renderInnerContent = () => (
    <>
      {/* Top Bar / Subheader */}
      <div className="flex items-center justify-between p-3.5 px-5 border-b border-[#262626] bg-[#212121] z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#ececec]">
              Graph View (Visualisasi Wikilink ala Obsidian)
            </h2>
            <p className="text-xs text-[#b4b4b4]">
              {snapshot
                ? `${snapshot.nodes.length} note • ${snapshot.edges.length} relasi keterhubungan wikilink`
                : 'Peta keterhubungan antar note markdown, tag, dan jejaring backlink'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Inside Graph */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#171717] border border-[#303030]">
            <Search className="w-3.5 h-3.5 text-[#707070]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Saring node atau tag..."
              className="bg-transparent border-none text-xs text-[#ececec] placeholder-[#707070] focus:outline-none w-44"
            />
          </div>

          {/* Controls Toggle */}
          <button
            type="button"
            onClick={() => setIsControlsOpen(!isControlsOpen)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              isControlsOpen
                ? 'bg-[#383838] text-white border-[#484848]'
                : 'bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] border-[#303030]'
            }`}
            title="Pengaturan Fisika & Tampilan Graf"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Pengaturan</span>
          </button>

          <button
            type="button"
            onClick={loadGraph}
            className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
            title="Muat Ulang Graf"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {!isEmbedded && (
            <button
              onClick={() => setGraphViewModalOpen(false)}
              className="p-1.5 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-[#141414]">
        <svg ref={svgRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {/* Hover Tooltip Card */}
        {hoveredNode && (
          <div
            style={{
              left: Math.min(hoveredNode.x + 14, (containerRef.current?.clientWidth || 600) - 240),
              top: Math.min(hoveredNode.y + 14, (containerRef.current?.clientHeight || 400) - 150),
            }}
            className="pointer-events-none absolute z-30 p-2.5 px-3 rounded-xl bg-[#262626] border border-[#383838] shadow-xl text-xs space-y-1.5 min-w-[180px] max-w-[240px]"
          >
            <div className="font-semibold text-[#ececec] flex items-center gap-1.5 truncate">
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{hoveredNode.node.title}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#707070] font-mono">
              <span className="flex items-center gap-1">
                <Link className="w-3 h-3 text-emerald-400" />
                {hoveredNode.node.backlink_count} backlinks
              </span>
              <span>•</span>
              <span>{hoveredNode.node.link_count} outbound</span>
            </div>
            {hoveredNode.node.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                {hoveredNode.node.tags.map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.2 rounded bg-[#1f1f1f] text-[9px] text-[#b4b4b4] font-mono flex items-center gap-0.5"
                  >
                    <Tag className="w-2.5 h-2.5 text-purple-400" />
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <div className="text-[10px] text-blue-400/80 pt-0.5">
              Klik node untuk membuka note
            </div>
          </div>
        )}

        {/* Corner Controls Panel (Obsidian style) */}
        <AnimatePresence>
          {isControlsOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 z-20 w-72 p-4 rounded-2xl bg-[#212121]/95 border border-[#383838] shadow-2xl backdrop-blur-sm space-y-3.5 text-xs text-[#b4b4b4]"
            >
              <div className="flex items-center justify-between pb-1 border-b border-[#303030]">
                <span className="font-semibold text-[#ececec]">Pengaturan Graf</span>
                <button
                  type="button"
                  onClick={() => setIsControlsOpen(false)}
                  className="p-1 rounded text-[#707070] hover:text-[#ececec]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Node Size Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Ukuran Node:</span>
                  <span className="font-mono text-[#ececec]">{nodeRadiusMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={nodeRadiusMultiplier}
                  onChange={(e) => setNodeRadiusMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Link Distance Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Jarak Garis (Link Distance):</span>
                  <span className="font-mono text-[#ececec]">{linkDistance}px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={200}
                  step={5}
                  value={linkDistance}
                  onChange={(e) => setLinkDistance(parseInt(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Force Repel Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>Daya Tolak (Repel Force):</span>
                  <span className="font-mono text-[#ececec]">{Math.abs(chargeStrength)}</span>
                </div>
                <input
                  type="range"
                  min={-400}
                  max={-60}
                  step={20}
                  value={chargeStrength}
                  onChange={(e) => setChargeStrength(parseInt(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Toggle Show All Labels */}
              <div className="flex items-center justify-between pt-1 border-t border-[#303030]">
                <span>Tampilkan Semua Judul:</span>
                <button
                  type="button"
                  onClick={() => setShowAllLabels(!showAllLabels)}
                  className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                    showAllLabels ? 'bg-blue-600' : 'bg-[#383838]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showAllLabels ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  if (isEmbedded) {
    return (
      <div className="w-full h-full flex flex-col bg-[#171717] relative overflow-hidden">
        {renderInnerContent()}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="w-full h-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-[#171717] border border-[#383838] shadow-2xl overflow-hidden relative"
        >
          {renderInnerContent()}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default GraphViewModal;
