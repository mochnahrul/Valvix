import React, { useState } from "react";
import { Sparkles } from "lucide-react";

interface DnaMetric {
  label: string;
  value: number; // 0 - 100
  shortLabel: string;
}

interface GamerDnaChartProps {
  metrics: DnaMetric[];
  className?: string;
}

export const GamerDnaChart: React.FC<GamerDnaChartProps> = ({ metrics, className = "" }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const size = 260;
  const center = size / 2;
  const radius = 92;
  const numAxes = metrics.length || 6;

  // Calculate polygon coordinates
  const getCoordinates = (index: number, value: number, maxRadius: number) => {
    const angle = ((Math.PI * 2) / numAxes) * index - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Generate web rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Radar polygon points
  const pointsString = metrics
    .map((m, i) => {
      const { x, y } = getCoordinates(i, Math.max(15, Math.min(100, m.value)), radius);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Chart container */}
      <div className="relative w-[260px] h-[260px]">
        {/* Glow backdrop behind chart */}
        <div className="absolute inset-0 bg-signal-emerald/5 blur-2xl rounded-full pointer-events-none" />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="dnaFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.15" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Concentric Web Rings */}
          {rings.map((ring, rIdx) => {
            const ringRadius = radius * ring;
            const ringPoints = Array.from({ length: numAxes })
              .map((_, i) => {
                const angle = ((Math.PI * 2) / numAxes) * i - Math.PI / 2;
                const x = center + ringRadius * Math.cos(angle);
                const y = center + ringRadius * Math.sin(angle);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");

            return (
              <polygon
                key={rIdx}
                points={ringPoints}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.1"
                strokeDasharray={rIdx < rings.length - 1 ? "3 3" : undefined}
                strokeWidth={rIdx === rings.length - 1 ? 1.2 : 0.8}
              />
            );
          })}

          {/* Radial Spokes */}
          {Array.from({ length: numAxes }).map((_, i) => {
            const outer = getCoordinates(i, 100, radius);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#ffffff"
                strokeOpacity="0.1"
                strokeWidth="1"
              />
            );
          })}

          {/* Filled Telemetry Polygon */}
          <polygon
            points={pointsString}
            fill="url(#dnaFillGrad)"
            stroke="#10B981"
            strokeWidth="2"
            filter="url(#glowFilter)"
            style={{ transition: "all 0.5s ease-out" }}
          />

          {/* Data Vertices (Nodes) - Glitch-free with fixed hit area */}
          {metrics.map((m, i) => {
            const { x, y } = getCoordinates(i, Math.max(15, Math.min(100, m.value)), radius);
            const isHovered = hoveredIdx === i;

            return (
              <g key={i}>
                {/* Visual pulse / ring (pointer-events-none so it doesn't glitch) */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 10 : 7}
                  fill="none"
                  stroke={isHovered ? "#34D399" : "#10B981"}
                  strokeOpacity={isHovered ? 0.8 : 0.35}
                  strokeWidth={isHovered ? 1.5 : 1}
                  className="pointer-events-none transition-all duration-200"
                />

                {/* Core dot (pointer-events-none) */}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5.5 : 4}
                  fill={isHovered ? "#34D399" : "#10B981"}
                  stroke="#0D0F14"
                  strokeWidth="2"
                  className="pointer-events-none transition-all duration-200"
                />

                {/* Stable invisible hit target to completely prevent flicker */}
                <circle
                  cx={x}
                  cy={y}
                  r={15}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}

          {/* Axis Labels - Explicit inline styles and presentation attributes for 100% accurate PNG export */}
          {metrics.map((m, i) => {
            const outer = getCoordinates(i, 118, radius);
            const isLeft = outer.x < center - 10;
            const isRight = outer.x > center + 10;
            const textAnchor = isRight ? "start" : isLeft ? "end" : "middle";
            const isHovered = hoveredIdx === i;

            return (
              <g key={i}>
                {/* Label text */}
                <text
                  x={outer.x}
                  y={outer.y}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fill={isHovered ? "#ffffff" : "#cbd5e1"}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  fontWeight="600"
                  style={{
                    fill: isHovered ? "#ffffff" : "#cbd5e1",
                    fontSize: "10px",
                    fontFamily:
                      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    transition: "fill 0.2s ease",
                  }}
                >
                  {m.label}
                </text>

                {/* Percentage text */}
                <text
                  x={outer.x}
                  y={outer.y + 11}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fill="#10B981"
                  fontSize="9"
                  fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  fontWeight="700"
                  style={{
                    fill: "#10B981",
                    fontSize: "9px",
                    fontFamily:
                      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 700,
                  }}
                >
                  {Math.round(m.value)}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Center telemetry core */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-elevated border border-white/20 flex items-center justify-center pointer-events-none shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-signal-emerald" />
        </div>
      </div>
    </div>
  );
};
