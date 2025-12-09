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

const CHART_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#00bcd4", "#ff7300", "#7cb342"];

const getAccountKeys = (rows) =>
  !rows?.length ? [] : Object.keys(rows[0]).filter((k) => k.endsWith("_Value") && k !== "Total_Value");

export default function Chart() {
  const [latestProj, setLatestProj] = useState(null);
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
          const sorted = items.slice().sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
          });
          setLatestProj(sorted[0]);
        }
      } catch (e) {
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
  if (!latestProj) return <ProjectionChart projection={null} />;

  const chartData = latestProj.data_json ? JSON.parse(latestProj.data_json) : [];
  const accountValueKeys = getAccountKeys(chartData);
  
  const currentYear = new Date().getFullYear();
  const labels = chartData.map((row) => `${currentYear + row.Year - 1}`);
  const datasets = [];

  accountValueKeys.forEach((key, i) => {
    datasets.push({
      label: key.replace("_Value", ""),
      data: chartData.map((row) => row[key] ?? 0),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "40",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
    });
  });

  if (chartData.length && chartData[0].Total_Value !== undefined) {
    datasets.push({
      label: "Total",
      data: chartData.map((row) => row.Total_Value ?? 0),
      borderColor: "#000000",
      backgroundColor: "#00000040",
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.1,
      fill: false,
    });
  }

  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: latestProj.name || "Projection Over Time" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
            return (
              label +
              new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                ctx.parsed.y ?? 0
              )
            );
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            }).format(v),
        },
      },
      x: { title: { display: true, text: "Year" } },
    },
  };

  return (
    <div style={{ height: 400, width: "100%" }}>
      <Line data={data} options={options} />
    </div>
  );
}