'use client';

import { occupancyColor } from '@/lib/utils';

interface Props {
  occupancy: number;
  maxOccupancy: number;
  percent: number;
}

export default function OccupancyGauge({ occupancy, maxOccupancy, percent }: Props) {
  const color  = occupancyColor(percent);
  const R      = 72;
  const cx     = 90;
  const cy     = 90;
  const stroke = 10;
  const circ   = 2 * Math.PI * R;
  const arc    = circ * 0.75;
  const offset = arc - (percent / 100) * arc;
  const startAngle = 135;

  const statusLabel =
    percent >= 85 ? 'Sehr voll' : percent >= 60 ? 'Gut besucht' : 'Ruhig';

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="180" height="160" viewBox="0 0 180 160">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none" stroke="#1e3054" strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle}, ${cx}, ${cy})`}
        />

        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(${startAngle}, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
          filter="url(#glow)"
        />

        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#e8edf5" fontSize="28" fontWeight="700">
          {percent}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#7a93b8" fontSize="12">
          {occupancy} / {maxOccupancy}
        </text>
      </svg>

      <span
        className="px-3 py-1 rounded-full text-xs font-medium"
        style={{ background: `${color}22`, color }}
      >
        {statusLabel}
      </span>
    </div>
  );
}
