import React, { useState } from "react";
import "./SidebarLayout.css";

// Wire real components (assumed default exports)
import Chart from "./Chart";
import Calculator from "./Calculator";
import ProjectionsTable from "./ProjectionsTable";

export default function SidebarLayout() {
  const [view, setView] = useState("calculator"); // "calculator" | "projections"

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Main sidebar">
        <h3 className="sidebar-title">Menu</h3>

        <button
          className={`sidebar-item ${view === "calculator" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "calculator"}
          onClick={() => setView("calculator")}
        >
          Calculator
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
        <section className="right-top">
          <Chart />
        </section>

        <section className="right-bottom">
          {view === "calculator" ? <Calculator /> : <ProjectionsTable />}
        </section>
      </main>
    </div>
  );
}
