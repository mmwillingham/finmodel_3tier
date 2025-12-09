import React, { useState, useEffect } from "react";
import ProjectionService from "../services/projection.service";
import CashFlowService from "../services/cashflow.service";
import Calculator from "./Calculator";
import ProjectionDetail from "./ProjectionDetail";
import ProjectionsTable from "./ProjectionsTable";
import Chart from "./Chart";
import CashFlowView from "./CashFlowView";
import CashFlowSummary from "./CashFlowSummary";
import SettingsModal from "./SettingsModal";
import "./SidebarLayout.css";

export default function SidebarLayout() {
  const [view, setView] = useState("home");
  const [cashFlowView, setCashFlowView] = useState(null);
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [editingProjection, setEditingProjection] = useState(null);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const fetchProjections = async () => {
    try {
      setLoading(true);
      const response = await ProjectionService.getProjections();
      const items = (response.data || []).slice().sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setProjections(items);
    } catch (err) {
      console.error("Error fetching projections:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjections();
  }, []);

  const handleProjectionCreated = async (projectionId) => {
    await fetchProjections();
    setEditingProjection(null);
    setView('detail');
    setSelectedProjectionId(projectionId);
  };

  const handleViewProjection = (projectionId) => {
    setSelectedProjectionId(projectionId);
    setView("detail");
  };

  const handleEdit = async (projection) => {
    try {
      setLoading(true);
      const full = await ProjectionService.getProjectionDetails(projection.id);
      setEditingProjection(full);
      setView("calculator");
    } catch (err) {
      console.error("Error loading projection for edit:", err);
      alert("Could not load projection details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this projection?");
    if (!ok) return;
    try {
      await ProjectionService.deleteProjection(id);
      await fetchProjections();
      setView("projections");
    } catch (err) {
      console.error("Error deleting projection:", err);
      alert("Failed to delete projection.");
    }
  };

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
          <section className="nav-section">
            <h3>Projections</h3>
            <button 
              className={`nav-btn ${view === 'home' ? 'active' : ''}`} 
              onClick={() => { setView('home'); setCashFlowView(null); }}
            >
              Dashboard
            </button>
            <button 
              className={`nav-btn ${view === 'projections' ? 'active' : ''}`} 
              onClick={() => { 
                setView('projections'); 
                setCashFlowView(null);
              }}
            >
              My Projections
            </button>
            <button 
              className={`nav-btn ${view === 'calculator' ? 'active' : ''}`} 
              onClick={() => { 
                setView('calculator'); 
                setCashFlowView(null); 
                setEditingProjection(null);
              }}
            >
              New Projection
            </button>
          </section>

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
          </section>

          <section className="nav-section">
            <h3>Settings</h3>
            <button 
              className={`nav-btn ${view === 'settings' ? 'active' : ''}`} 
              onClick={() => setView('settings')}
            >
              General Settings
            </button>
          </section>
        </nav>
      </aside>

      <main className="main-content">
        {loading && <div className="loading">Loading...</div>}
        {!loading && view === "home" && (
          <div className="dashboard">
            <h2>Welcome to the Cash Flow Projection Tool</h2>
            <p>Select a projection or create a new one to get started.</p>
          </div>
        )}
        {!loading && view === "projections" && (
          <div className="projections">
            <h2>My Projections</h2>
            <ProjectionsTable 
              projections={projections} 
              onView={handleViewProjection} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
            />
          </div>
        )}
        {!loading && view === "calculator" && (
          <div className="calculator">
            <h2>{editingProjection ? "Edit Projection" : "New Projection"}</h2>
            <Calculator 
              projection={editingProjection} 
              onSave={handleProjectionCreated} 
              onCancel={() => setEditingProjection(null)}
            />
          </div>
        )}
        {!loading && view === "detail" && selectedProjectionId && (
          <div className="projection-detail">
            <h2>Projection Detail</h2>
            <ProjectionDetail 
              projectionId={selectedProjectionId} 
              onBack={() => setView("projections")}
            />
          </div>
        )}
        {!loading && view === "cashflow" && (
          <div className="cashflow-view">
            <h2>Cash Flow {cashFlowView === 'income' ? "Income" : "Expenses"}</h2>
            <CashFlowView 
              items={cashFlowView === 'income' ? incomeItems : expenseItems} 
              onRefresh={refreshCashflow}
            />
          </div>
        )}
        {!loading && view === "settings" && (
          <div className="settings">
            <h2>Settings</h2>
            <SettingsModal 
              onClose={() => setShowSettings(false)} 
              isOpen={showSettings}
            />
          </div>
        )}
        {view === 'calculator' && (
          <section className="right-content">
            <Calculator
              key={editingProjection ? editingProjection.id : 'new'}
              onProjectionCreated={handleProjectionCreated}
              editingProjection={editingProjection}
            />
          </section>
        )}
      </main>
    </div>
  );
}
