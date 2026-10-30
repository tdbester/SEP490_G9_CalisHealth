import { useId, useState } from "react";
import { Box } from "@mui/material";
import { AD } from "../../theme-admin";

// Geometry follows the Figma chart area (742 x 221 plot), in a 820 x 262 viewBox.
const VB_W = 820;
const VB_H = 262;
const PLOT = { left: 59, right: 801, top: 13, bottom: 234 };
const TICK_COUNT = 6; // 7 horizontal grid lines, like the design
const TOOLTIP = { w: 140, h: 46, gap: 15 };

/**
 * Picks a "nice" y-axis step (1, 2, 2.5, 3, 5 x 10^n) so that 6 intervals cover the max value.
 * Matches the Figma axes: 0-1500 step 250 (30 days), 0-6000 step 1000 (6 months),
 * 0-18000 step 3000 (1 year).
 */
function pickStep(maxValue) {
  const raw = Math.max(maxValue, 1) / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 3, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  return step ?? magnitude * 10;
}

const fmt = (n) => n.toLocaleString("en-US");

/**
 * Line chart with area fill. Hover or focus a point to move the tooltip;
 * the last point is highlighted by default.
 *
 * @param {{ points: { label: string, tooltipLabel: string, value: number }[] }} props
 */
export default function ActivityTrendChart({ points }) {
  const gradientId = useId();
  const [hovered, setHovered] = useState(null);

  if (!points.length) return null;

  const count = points.length;
  const activeIndex = hovered !== null && hovered < count ? hovered : count - 1;

  const step = pickStep(Math.max(...points.map((p) => p.value)));
  // The 5th tick of a decimal step (e.g. 2.5) can be fractional, so labels use fmt().
  const yMax = step * TICK_COUNT;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => step * i);

  const xAt = (i) =>
    count === 1
      ? (PLOT.left + PLOT.right) / 2
      : PLOT.left + ((PLOT.right - PLOT.left) * i) / (count - 1);
  const yAt = (v) => PLOT.bottom - (v / yMax) * (PLOT.bottom - PLOT.top);

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[count - 1].x} ${PLOT.bottom} L${coords[0].x} ${PLOT.bottom} Z`;

  const active = coords[activeIndex];
  const tipX = Math.min(Math.max(active.x - TOOLTIP.w + 22, 0), VB_W - TOOLTIP.w);
  const below = active.y + TOOLTIP.gap + TOOLTIP.h <= VB_H - 20;
  const tipY = below ? active.y + TOOLTIP.gap : active.y - TOOLTIP.gap - TOOLTIP.h;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 560 }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          role="group"
          aria-label="User activity trend chart: workout logs"
          onMouseLeave={() => setHovered(null)}
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9A45C4" stopOpacity="0.6" />
              <stop offset="1" stopColor="#2A1458" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* horizontal grid + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PLOT.left} x2={PLOT.right} y1={yAt(t)} y2={yAt(t)} stroke={AD.grid} />
              <text
                x={PLOT.left - 10}
                y={yAt(t) + 4}
                textAnchor="end"
                fontSize="12"
                fill={AD.navText}
              >
                {t}
              </text>
            </g>
          ))}

          {/* vertical grid + x labels */}
          {points.map((p, i) => (
            <g key={p.label}>
              <line x1={xAt(i)} x2={xAt(i)} y1={PLOT.top} y2={PLOT.bottom} stroke={AD.grid} />
              <text x={xAt(i)} y={PLOT.bottom + 23} textAnchor="middle" fontSize="12" fill={AD.navText}>
                {p.label}
              </text>
            </g>
          ))}

          <text
            transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`}
            x="12"
            y={(PLOT.top + PLOT.bottom) / 2 + 4}
            textAnchor="middle"
            fontSize="12"
            fill={AD.muted}
          >
            Workout Logs
          </text>

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={AD.chartLine}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* points */}
          {coords.map((c, i) => (
            <g key={points[i].label}>
              {i === activeIndex ? (
                <circle cx={c.x} cy={c.y} r="7" fill={AD.chartPointHighlight} stroke="#fff" strokeWidth="2" />
              ) : (
                <circle cx={c.x} cy={c.y} r="4.5" fill={AD.chartLine} />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r="14"
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${points[i].tooltipLabel}: ${fmt(points[i].value)} workout logs`}
                style={{ cursor: "pointer", outline: "none" }}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              />
            </g>
          ))}

          {/* tooltip */}
          <g pointerEvents="none">
            <rect
              x={tipX}
              y={tipY}
              width={TOOLTIP.w}
              height={TOOLTIP.h}
              rx="10"
              fill={AD.toggleBg}
              stroke={AD.logoBoxBorder}
            />
            <text x={tipX + 11} y={tipY + 19} fontSize="11.5" fill={AD.navText}>
              {points[activeIndex].tooltipLabel}
            </text>
            <circle cx={tipX + 14.5} cy={tipY + 32} r="3.5" fill={AD.chartLine} />
            <text x={tipX + 25} y={tipY + 36} fontSize="12" fill="#fff">
              {fmt(points[activeIndex].value)} Workout Logs
            </text>
          </g>
        </svg>
      </Box>
    </Box>
  );
}
