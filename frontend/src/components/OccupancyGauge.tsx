'use client';

import { occupancyColor, occupancyStatus } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Props {
  occupancy: number;
  maxOccupancy: number;
  percent: number;
}

export default function OccupancyGauge({ occupancy, maxOccupancy, percent }: Props) {
  const color = occupancyColor(percent);
  const r = 72;
  const cx = 90;
  const cy = 90;
  const stroke = 10;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (percent / 100) * arc;

  const status = occupancyStatus(percent);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="180" height="160" viewBox="0 0 180 160">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#e6e5e0"
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135, ${cx}, ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(135, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#26251e" fontSize="28" fontWeight="600">
          {percent}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#5a5852" fontSize="12">
          {occupancy} / {maxOccupancy}
        </text>
      </svg>

      <Badge variant={status.variant}>{status.label}</Badge>
    </div>
  );
}
