import React, { useState, useEffect } from "react";
import "./SidebarLayout.css";
import ApiService from "../services/api.service";

import Chart from "./Chart";
import Calculator from "./Calculator";
import ProjectionsTable from "./ProjectionsTable";

export default function SidebarLayout() {
  const [view, setView] = useState("home"); // "home" | "calculator" | "projections"
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjections = async () => {
      try {
        setLoading(true);
        const response = await ApiService.get("/projections");
        const items = (response.data || []).slice().sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tb - ta;
        });
        setProjections(items);
      } catch (err) {
        console.error("Error fetching projections:", err);
        setProjections([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProjections();
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Main sidebar">
        <h3 className="sidebar-title">Menu</h3>

        <button
          className={`sidebar-item ${view === "home" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "home"}
          onClick={() => setView("home")}
        >
          Home
        </button>

        <button
          className={`sidebar-item ${view === "calculator" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "calculator"}
          onClick={() => setView("calculator")}
        >
          New Projection
        </button>

        <button
          className={`sidebar-item ${view === "projections" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "projections"}
          onClick={() => setView("projections")}
        >
          My Projections
        </button>
      </aside>

      <main className="main" role="main">
        {view === "home" && (
          <>
            <section className="right-top">
              <Chart />
            </section>
            <section className="right-bottom">
              {loading ? (
                <p>Loading projections...</p>
              ) : projections.length > 0 ? (
                <ProjectionsTable projections={projections} />
              ) : (
                <p>No projections yet. Create one to get started!</p>
              )}
            </section>
          </>
        )}

        {view === "calculator" && (
          <section className="right-content">
            <Calculator />
          </section>
        )}

        {view === "projections" && (
          <section className="right-content">
            {loading ? (
              <p>Loading projections...</p>
            ) : projections.length > 0 ? (
              <ProjectionsTable projections={projections} />
            ) : (
              <p>No projections yet.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
