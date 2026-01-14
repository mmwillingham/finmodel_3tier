import React, { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import ApiService from "../services/api.service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const COLORS = [
  "#0b57d0",
  "#d9534f",
  "#f0ad4e",
  "#5cb85c",
  "#5bc0de",
  "#9366cc",
  "#ff7f50",
  "#8a8a8a",
];

export default function ProjectionChart({ projection, projectionId }) {
  const [proj, setProj] = useState(projection ?? null);
  const [loading, setLoading] = useState(!projection);
  const chartRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (projection) {
        setProj(projection);
        setLoading(false);
        return;
      }
      if (!projectionId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // This endpoint now returns ProjectionDetailOut with nested data
        const res = await ApiService.get(`/projections/${projectionId}`);
        if (!mounted) return;
        setProj(res.data || null);
      } catch (e) {
        console.error("Error fetching projection details:", e);
        setProj(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [projection, projectionId]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      try {
        const inst = chartRef.current;
        if (inst?.chart && typeof inst.chart.resize === "function") inst.chart.resize();
        if (typeof inst?.resize === "function") inst.resize();
      } catch (e) {
        console.error("Error resizing chart:", e);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!proj) return;
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      try {
        const inst = chartRef.current;
        if (inst?.chart && typeof inst.chart.resize === "function") inst.chart.resize();
        if (typeof inst?.resize === "function") inst.resize();
      } catch (e) {
        console.error("Error resizing chart on timeout:", e);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [proj]);

  if (loading) return <div>Loading chart...</div>;
  
  // Parse data_json instead of using time_series_data
  let chartData = [];
  if (proj?.data_json) {
    try {
      chartData = JSON.parse(proj.data_json);
    } catch (e) {
      console.error("Error parsing data_json:", e);
    }
  }
  
  if (!proj || !chartData || chartData.length === 0) {
    return <div>No projection data available to chart.</div>;
  }

  // Extract years and labels from data_json
  const labels = chartData.map(row => `Year ${row.Year}`);
  const datasets = [];

  // --- Add Net Worth data ---
  const netWorthData = chartData.map(row => row["Net Worth"] || 0);
  datasets.push({
    label: "Net Worth",
    data: netWorthData,
    borderColor: COLORS[0], // Use first color for Net Worth
    backgroundColor: `${COLORS[0]}22`,
    tension: 0.2,
    fill: true,
  });

  // --- Add Total Assets and Total Liabilities ---
  const totalAssetsData = chartData.map(row => row["Total Assets"] || 0);
  datasets.push({
    label: "Total Assets",
    data: totalAssetsData,
    borderColor: COLORS[3], // Green
    backgroundColor: `${COLORS[3]}22`,
    tension: 0.2,
    fill: false,
  });

  const totalLiabilitiesData = chartData.map(row => row["Total Liabilities"] || 0);
  datasets.push({
    label: "Total Liabilities",
    data: totalLiabilitiesData,
    borderColor: COLORS[1], // Red
    backgroundColor: `${COLORS[1]}22`,
    tension: 0.2,
    fill: false,
  });


  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { display: true },
      y: {
        display: true,
        beginAtZero: false, // Net worth can go below zero
        ticks: {
          callback: function (value) {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: "compact",
              compactDisplay: "short",
            }).format(value);
          },
        },
      },
    },
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{proj?.name || "Projection"}</h3>
      <div ref={wrapperRef} className="chart-wrapper">
        <Line ref={chartRef} key={proj?.id ?? "proj-chart"} data={data} options={options} />
      </div>
    </div>
  );
}
