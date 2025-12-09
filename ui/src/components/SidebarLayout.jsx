import React, { useEffect, useState } from "react";
import "./SidebarLayout.css";
import ApiService from "../services/api.service";
import CashFlowService from "../services/cashflow.service";

import Chart from "./Chart";
import Calculator from "./Calculator";
import ProjectionsTable from "./ProjectionsTable";
import ProjectionDetail from "./ProjectionDetail";
import CashFlowView from "./CashFlowView";
import CashFlowSummary from "./CashFlowSummary";
import SettingsModal from "./SettingsModal";

export default function SidebarLayout() {
  const [view, setView] = useState("home");
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [editingProjection, setEditingProjection] = useState(null);
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashFlowView, setCashFlowView] = useState(null); // 'income' | 'expenses'
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // Load persisted cashflow
  useEffect(() => {
    try {
      const inc = JSON.parse(localStorage.getItem("cashflow_income") || "[]");
      const exp = JSON.parse(localStorage.getItem("cashflow_expenses") || "[]");
      setIncomeItems(Array.isArray(inc) ? inc : []);
      setExpenseItems(Array.isArray(exp) ? exp : []);
    } catch (e) {
      console.error("Failed to load cashflow from storage", e);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem("cashflow_income", JSON.stringify(incomeItems));
  }, [incomeItems]);

  useEffect(() => {
    localStorage.setItem("cashflow_expenses", JSON.stringify(expenseItems));
  }, [expenseItems]);

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

  const handleProjectionCreated = async (projectionId) => {
    await fetchProjections();
    setEditingProjection(null);  // Clear editing state
    setView('detail');
    setSelectedProjectionId(projectionId);
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

  // load cashflow once
  useEffect(() => {
    const load = async () => {
      try {
        const [inc, exp] = await Promise.all([
          CashFlowService.list(true),
          CashFlowService.list(false),
        ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
      } catch (e) {
        console.error("Failed to load cashflow", e);
      }
    };
    load();
  }, []);

  const refreshCashflow = async () => {
    const [inc, exp] = await Promise.all([
      CashFlowService.list(true),
      CashFlowService.list(false),
    ]);
    setIncomeItems(inc.data || []);
    setExpenseItems(exp.data || []);
  };

  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {/* Projections Section */}
          <section className="nav-section">
            <h3>Projections</h3>
            <button className={`nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => { setView('home'); setCashFlowView(null); }}>
              Dashboard
            </button>
          </section>

          {/* Cash Flow Section */}
          <section className="nav-section">
            <h3>Cash Flow</h3>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'expenses' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expenses'); }}
            >
              Expenses
            </button>
            <button
              className={`nav-btn ${view === 'cashflow-summary' ? 'active' : ''}`}
              onClick={() => { setView('cashflow-summary'); setCashFlowView(null); }}
            >
              Surplus / Deficit
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
          <section className="right-content centered">
            <CashFlowView
              type={cashFlowView}
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              refreshCashflow={refreshCashflow}
            />
          </section>
        )}

        {view === 'cashflow-summary' && (
          <section className="right-content centered">
            <CashFlowSummary incomeItems={incomeItems} expenseItems={expenseItems} />
          </section>
        )}
      </main>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
