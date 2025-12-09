import React, { useState, useEffect } from "react";
import "./SidebarLayout.css";
import ApiService from "../services/api.service";

import Chart from "./Chart";
import Calculator from "./Calculator";
import ProjectionsTable from "./ProjectionsTable";
import ProjectionDetail from "./ProjectionDetail";
import CashFlowView from "./CashFlowView";

export default function SidebarLayout() {
  const [view, setView] = useState("home");
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [editingProjection, setEditingProjection] = useState(null);
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashFlowView, setCashFlowView] = useState(null); // "income" or "expenses"

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
    <div className="sidebar-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {/* Projections Section */}
          <section className="nav-section">
            <h3>Projections</h3>
            <button 
              className={`nav-btn ${view === 'home' ? 'active' : ''}`}
              onClick={() => { setView('home'); setCashFlowView(null); }}
            >
              Dashboard
            </button>
            <button 
              className={`nav-btn ${view === 'calculator' ? 'active' : ''}`}
              onClick={() => { setView('calculator'); setCashFlowView(null); }}
            >
              New Projection
            </button>
            <button 
              className={`nav-btn ${view === 'projections' ? 'active' : ''}`}
              onClick={() => { setView('projections'); setCashFlowView(null); }}
            >
              My Projections
            </button>
          </section>

          {/* Cash Flow Section */}
          <section className="nav-section">
            <h3>Cash Flow</h3>
            <button 
              className={`nav-btn ${cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income
            </button>
            <button 
              className={`nav-btn ${cashFlowView === 'expenses' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expenses'); }}
            >
              Expenses
            </button>
          </section>
        </nav>
      </aside>

      <main className="main-content">
        {view === 'home' && (
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

        {view === 'calculator' && (
          <section className="right-content">
            <Calculator
              onProjectionCreated={handleProjectionCreated}
              editingProjection={editingProjection}
            />
          </section>
        )}

        {view === 'projections' && (
          <section className="right-content">
            {loading ? (
              <p>Loading...</p>
            ) : projections.length > 0 ? (
              <ProjectionsTable projections={projections} onViewProjection={handleViewProjection} />
            ) : (
              <p>No projections yet.</p>
            )}
          </section>
        )}

        {view === 'detail' && selectedProjectionId && (
          <section className="right-content">
            <ProjectionDetail
              projectionId={selectedProjectionId}
              onEdit={handleEditProjection}
              onDelete={handleDeleteProjection}
            />
          </section>
        )}

        {view === 'cashflow' && (
          <section className="right-content">
            <CashFlowView type={cashFlowView} />
          </section>
        )}
      </main>
    </div>
  );
}
