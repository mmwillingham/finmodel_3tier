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
import { createDarkLineChartOptions, DARK_CHART_SERIES_COLORS } from "../utils/darkChartTheme";
import "./Chart.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export default function ProjectionChart({ projection, projectionId }: any) {
  const [proj, setProj] = useState(projection ?? null);
  const [loading, setLoading] = useState(!projection);
  const chartRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);

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
      } catch (e: any) {
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
      } catch (e: any) {
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
      } catch (e: any) {
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
    } catch (e: any) {
    }
  }
  
  if (!proj || !chartData || chartData.length === 0) {
    return <div>No projection data available to chart.</div>;
  }

  // Extract years and labels from data_json
  const labels = chartData.map((row: any) => `Year ${row.Year}`);
  const datasets = [];

  // --- Add Net Worth data ---
  const netWorthData = chartData.map((row: any) => row["Net Worth"] || 0);
  datasets.push({
    label: "Net Worth",
    data: netWorthData,
    borderColor: DARK_CHART_SERIES_COLORS.expected,
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    tension: 0.35,
    borderWidth: 2.5,
    pointRadius: 1.5,
    fill: false,
  });

  // --- Add Total Assets and Total Liabilities ---
  const totalAssetsData = chartData.map((row: any) => row["Total Assets"] || 0);
  datasets.push({
    label: "Total Assets",
    data: totalAssetsData,
    borderColor: DARK_CHART_SERIES_COLORS.optimistic,
    backgroundColor: "rgba(52, 211, 153, 0.16)",
    tension: 0.32,
    pointRadius: 1.5,
    fill: true,
  });

  const totalLiabilitiesData = chartData.map((row: any) => row["Total Liabilities"] || 0);
  datasets.push({
    label: "Total Liabilities",
    data: totalLiabilitiesData,
    borderColor: DARK_CHART_SERIES_COLORS.liabilities,
    backgroundColor: "rgba(251, 113, 133, 0.16)",
    tension: 0.3,
    pointRadius: 1.5,
    fill: false,
  });


  const data = { labels, datasets };
  const options = createDarkLineChartOptions({
    beginAtZero: false,
    xAxisTitle: "End of Year",
    compactYAxis: true,
    showLegend: true,
  });

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{proj?.name || "Projection"}</h3>
      <div ref={wrapperRef} className="chart-wrapper">
        <Line ref={chartRef} key={proj?.id ?? "proj-chart"} data={data} options={options as any} />
      </div>
    </div>
  );
}
