// Mock data for the Admin Dashboard, matching the Figma frame.
// TODO: replace with real data once the backend exposes /api/admin/dashboard.

export const ADMIN_STATS = {
  totalUsers: 12482,
  totalSkillExercises: 86,
  totalHealthExercises: 100,
};

// subtitle: text under the card title. Figma: 30 days = per week, 6 months = per month, 1 year = per quarter.
export const TREND_RANGES = [
  { key: "30d", label: "30 Days", subtitle: "Total workout logs per week" },
  { key: "6m", label: "6 Months", subtitle: "Total workout logs per month" },
  { key: "1y", label: "1 Year", subtitle: "Total workout logs per quarter" },
];

// label: x axis text, tooltipLabel: text shown in the tooltip, value: workout logs
export const TREND_DATA = {
  "30d": [
    { label: "Sep 29", tooltipLabel: "Sep 29, 2026", value: 880 },
    { label: "Oct 06", tooltipLabel: "Oct 06, 2026", value: 1120 },
    { label: "Oct 13", tooltipLabel: "Oct 13, 2026", value: 960 },
    { label: "Oct 20", tooltipLabel: "Oct 20, 2026", value: 1340 },
    { label: "Oct 27", tooltipLabel: "Oct 27, 2026", value: 1230 },
  ],
  // Values read from the Figma "admin-dashboard-6months" frame (704:173); Oct = 5,200 matches the tooltip.
  "6m": [
    { label: "May", tooltipLabel: "May 2026", value: 3900 },
    { label: "Jun", tooltipLabel: "Jun 2026", value: 4600 },
    { label: "Jul", tooltipLabel: "Jul 2026", value: 4200 },
    { label: "Aug", tooltipLabel: "Aug 2026", value: 5100 },
    { label: "Sep", tooltipLabel: "Sep 2026", value: 5500 },
    { label: "Oct", tooltipLabel: "Oct 2026", value: 5200 },
  ],
  // Values read from the Figma "admin-dashboard-1year" frame (704:4), grouped by quarter.
  // Aug-Oct = 16,200 matches the tooltip; the other three are estimated from point positions.
  "1y": [
    { label: "Nov–Jan", tooltipLabel: "Nov 2025–Jan 2026", value: 11800 },
    { label: "Feb–Apr", tooltipLabel: "Feb–Apr 2026", value: 13900 },
    { label: "May–Jul", tooltipLabel: "May–Jul 2026", value: 14600 },
    { label: "Aug–Oct", tooltipLabel: "Aug–Oct 2026", value: 16200 },
  ],
};
