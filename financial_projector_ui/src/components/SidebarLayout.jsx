import React, { useState, useEffect } from "react";
import "./SidebarLayout.css";
import ApiService from "../services/api.service";

import Chart from "./Chart";
import Calculator from "./Calculator";
import ProjectionsTable from "./ProjectionsTable";
import ProjectionDetail from "./ProjectionDetail";

export default function SidebarLayout() {
  const [view, setView] = useState("home");
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [editingProjection, setEditingProjection] = useState(null);
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchProjections(); }, []);

  const handleProjectionCreated = async (id) => {
    await fetchProjections();
    if (id) {
      setSelectedProjectionId(id);
      setView("detail");
    } else {
      setView("home");
    }
  };

  const handleViewProjection = (id) => {
    setSelectedProjectionId(id);
    setView("detail");
  };

  const handleEditProjection = (projection) => {
    setEditingProjection(projection);
    setView("calculator");
  };

  const handleDeleteProjection = async (id) => {
    if (!id) return;
    const ok = window.confirm("Delete this projection?");
    if (!ok) return;
    try {
      await ApiService.delete(`/projections/${id}`);
      await fetchProjections();
      setSelectedProjectionId(null);
      setView("projections");
    } catch (err) {
      console.error("Error deleting projection:", err);
      alert("Failed to delete projection.");
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Main sidebar">
        <h3 className="sidebar-title">Menu</h3>

        <button
          className={`sidebar-item ${view === "home" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "home"}
          onClick={() => {
            setView("home");
            setSelectedProjectionId(null);
          }}
        >
          Home
        </button>

        <button
          className={`sidebar-item ${view === "calculator" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "calculator"}
          onClick={() => {
            setView("calculator");
            setSelectedProjectionId(null);
          }}
        >
          New Projection
        </button>

        <button
          className={`sidebar-item ${view === "projections" ? "active" : ""}`}
          type="button"
          aria-pressed={view === "projections"}
          onClick={() => {
            setView("projections");
            setSelectedProjectionId(null);
          }}
        >
          My Projections
        </button>
      </aside>

      <main className="main" role="main">
        {view === "home" && (
          <>
            <section className="right-top">
              <Chart projection={projections[0]} loading={loading} />
            </section>
            <section className="right-bottom">
              {loading ? (
                <p>Loading projections...</p>
              ) : projections.length > 0 ? (
                <ProjectionsTable projections={projections} onViewProjection={handleViewProjection} />
              ) : (
                <p>No projections yet. Create one to get started!</p>
              )}
            </section>
          </>
        )}

        {view === "calculator" && (
          <section className="right-content">
            <Calculator
              onProjectionCreated={handleProjectionCreated}
              editingProjection={editingProjection}
            />
          </section>
        )}

        {view === "projections" && (
          <section className="right-content">
            {loading ? (
              <p>Loading projections...</p>
            ) : projections.length > 0 ? (
              <ProjectionsTable projections={projections} onViewProjection={handleViewProjection} />
            ) : (
              <p>No projections yet.</p>
            )}
          </section>
        )}

        {view === "detail" && selectedProjectionId && (
          <section className="right-content">
            <ProjectionDetail
              projectionId={selectedProjectionId}
              onEdit={handleEditProjection}
              onDelete={handleDeleteProjection}
            />
          </section>
        )}
      </main>
    </div>
  );
}
