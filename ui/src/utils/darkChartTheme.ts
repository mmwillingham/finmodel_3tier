const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const DARK_CHART_SERIES_COLORS = {
  optimistic: "#34d399",
  expected: "#38bdf8",
  conservative: "#fbbf24",
  liabilities: "#fb7185",
  neutral: "#a5b4fc",
  accent: "#22d3ee",
};

export const darkChartPanelSx = {
  borderRadius: 3,
  p: 2,
  border: "1px solid transparent",
  background:
    "radial-gradient(110% 95% at 50% 100%, rgba(14, 165, 233, 0.10) 0%, rgba(14, 165, 233, 0.00) 60%), linear-gradient(180deg, #0f172a 0%, #111827 100%)",
  boxShadow: "0 22px 42px rgba(2, 6, 23, 0.35)",
};

export const formatCompactCurrency = (value: any) => compactCurrencyFormatter.format(Number(value) || 0);
export const formatFullCurrency = (value: any) => fullCurrencyFormatter.format(Number(value) || 0);

export const createDarkLineChartOptions = ({
  title,
  xAxisTitle = "End of Year",
  beginAtZero = false,
  compactYAxis = true,
  legendPosition = "top",
  showLegend = true,
}: any = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      display: showLegend,
      position: legendPosition,
      labels: {
        color: "#cbd5e1",
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
      },
    },
    title: {
      display: Boolean(title),
      text: title || "",
      color: "#f8fafc",
      font: {
        size: 16,
        weight: "600",
      },
    },
    tooltip: {
      backgroundColor: "rgba(2, 6, 23, 0.96)",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(56, 189, 248, 0.45)",
      borderWidth: 1,
      callbacks: {
        label: (context: any) => {
          const label = context.dataset?.label ? `${context.dataset.label}: ` : "";
          return `${label}${formatFullCurrency(context.parsed.y)}`;
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: Boolean(xAxisTitle),
        text: xAxisTitle || "",
        color: "#94a3b8",
      },
      ticks: {
        color: "#94a3b8",
      },
      grid: {
        color: "rgba(148, 163, 184, 0.16)",
        borderColor: "rgba(148, 163, 184, 0.3)",
      },
    },
    y: {
      beginAtZero,
      ticks: {
        color: "#94a3b8",
        callback: (value: any) => (compactYAxis ? formatCompactCurrency(value) : formatFullCurrency(value)),
      },
      grid: {
        color: "rgba(148, 163, 184, 0.16)",
        borderColor: "rgba(148, 163, 184, 0.3)",
      },
    },
  },
});

export const createDarkPieChartOptions = ({ title, legendPosition = "right", formatValue }: any = {}) => ({
  responsive: true,
  plugins: {
    legend: {
      position: legendPosition,
      labels: {
        color: "#cbd5e1",
        usePointStyle: true,
        pointStyle: "circle",
      },
    },
    title: {
      display: Boolean(title),
      text: title || "",
      color: "#f8fafc",
      font: {
        size: 15,
        weight: "600",
      },
    },
    tooltip: {
      backgroundColor: "rgba(2, 6, 23, 0.96)",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(56, 189, 248, 0.45)",
      borderWidth: 1,
      callbacks: {
        label: (context: any) => {
          const label = context.label || "";
          const value = Number(context.parsed) || 0;
          const total = (context.dataset?.data || []).reduce((sum: any, item: any) => sum + (Number(item) || 0), 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
          const valueText = formatValue ? formatValue(value) : formatFullCurrency(value);
          return `${label}: ${valueText} (${percentage}%)`;
        },
      },
    },
  },
});
