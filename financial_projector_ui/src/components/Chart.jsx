import React, { useEffect, useState } from "react";
import ApiService from "../services/api.service";
import ProjectionChart from "./ProjectionChart";
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
          // pass the full projection object to ProjectionChart so it renders identical
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
  if (!latestProj) return <div>No projection available to chart.</div>;
  // Render ProjectionChart with the full object (same as ProjectionDetail)
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Chart Placeholder</h2>
      <p>Add your chart component here</p>
    </div>
  );
}