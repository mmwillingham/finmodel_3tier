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
} from "chart.js";
import ApiService from "../services/api.service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

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
      if (projection) return;
      if (!projectionId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await ApiService.get(`/projections/${projectionId}`);
        if (!mounted) return;
        setProj(res.data || null);
      } catch (e) {
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
      } catch (e) {}
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
      } catch (e) {}
    }, 150);
    return () => clearTimeout(t);
  }, [proj]);

  if (loading) return <div>Loading chart...</div>;
  if (!proj) return <div>No projection available to chart.</div>;

  let labels = [];
  const datasets = [];
  let yearlyData = [];
  
  if (proj?.data_json) {
    try {
      yearlyData = JSON.parse(proj.data_json);
    } catch (e) {
      yearlyData = [];
    }
  }

  const accountNames = [];
  if (yearlyData.length > 0) {
    const firstYear = yearlyData[0];
    Object.keys(firstYear).forEach(key => {
      if (key.endsWith('_Value') && key !== 'Total_Value') {
        accountNames.push(key.replace('_Value', ''));
      }
    });
  }

  if (accountNames.length > 0) {
    labels = yearlyData.map(y => `Y${y.Year}`);
    
    accountNames.forEach((accName, idx) => {
      const values = yearlyData.map(y => Number(y[`${accName}_Value`] ?? 0));
      datasets.push({
        label: accName,
        data: values,
        borderColor: COLORS[idx % COLORS.length],
        backgroundColor: `${COLORS[idx % COLORS.length]}22`,
        tension: 0.2,
        fill: false,
      });
    });

    const total = yearlyData.map(y => Number(y.Total_Value ?? y.Value ?? 0));
    datasets.push({
      label: "Total",
      data: total,
      borderColor: "#0b57d0",
      backgroundColor: "rgba(11,87,208,0.12)",
      tension: 0.2,
      fill: true,
    });
  } else {
    const start = Number(proj.total_contributed ?? 0);
    const end = Number(proj.final_value ?? start);
    const yrs = Math.max(1, Number(proj.years || 10));
    labels = Array.from({ length: yrs + 1 }, (_, i) => `${i}y`);
    const step = (end - start) / yrs;
    const dataPoints = labels.map((_, i) => Math.round((start + step * i) * 100) / 100);

    datasets.push({
      label: proj.name || "Projection",
      data: dataPoints,
      borderColor: "#0b57d0",
      backgroundColor: "rgba(11,87,208,0.12)",
      tension: 0.2,
      fill: true,
    });
  }

  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true }, tooltip: { mode: "index", intersect: false } },
    scales: { x: { display: true }, y: { display: true, beginAtZero: true } },
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