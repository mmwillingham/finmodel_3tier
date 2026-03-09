import React, { useEffect, useState } from "react";
import ApiService from "../services/api.service";
import ProjectionChart from "./ProjectionChart";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { createDarkLineChartOptions, DARK_CHART_SERIES_COLORS } from "../utils/darkChartTheme";
import "./Chart.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee"];

const getAccountKeys = (rows: any) =>
  !rows?.length ? [] : Object.keys(rows[0]).filter((k: any) => k.endsWith("_Value") && k !== "Total_Value");

export default function Chart() {
  const [latestProj, setLatestProj] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await ApiService.get("/projections");
        if (!mounted) return;
        const items = res.data || [];
        if (items.length === 0) {
          setLatestProj(null);
        } else {
          const sorted = items.slice().sort((a: any, b: any) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
          });
          setLatestProj(sorted[0]);
        }
      } catch (e: any) {
        setLatestProj(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading chart...</div>;
  if (!latestProj) return <ProjectionChart projection={null} projectionId={null} />;

  const chartData = latestProj.data_json ? JSON.parse(latestProj.data_json) : [];
  const accountValueKeys = getAccountKeys(chartData);
  
  const currentYear = new Date().getFullYear();
  const labels = chartData.map((row: any) => `${currentYear + row.Year - 1}`);
  const datasets = [];

  accountValueKeys.forEach((key: any, i: any) => {
    datasets.push({
      label: key.replace("_Value", ""),
      data: chartData.map((row: any) => row[key] ?? 0),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "40",
      borderWidth: 2,
      pointRadius: 1.5,
      tension: 0.3,
      fill: false,
    });
  });

  if (chartData.length && chartData[0].Total_Value !== undefined) {
    datasets.push({
      label: "Total",
      data: chartData.map((row: any) => row.Total_Value ?? 0),
      borderColor: DARK_CHART_SERIES_COLORS.expected,
      backgroundColor: "rgba(56, 189, 248, 0.20)",
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    });
  }

  const data = { labels, datasets };
  const options = createDarkLineChartOptions({
    title: latestProj.name || "Projection Over Time",
    beginAtZero: true,
    xAxisTitle: "Year",
  });

  return (
    <div style={{ height: 400, width: "100%" }}>
      <Line data={data as any} options={options as any} />
    </div>
  );
}