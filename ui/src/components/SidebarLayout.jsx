import React, { useState, useEffect } from "react";
import ProjectionService from "../services/projection.service";
import CashFlowService from "../services/cashflow.service";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import Calculator from "./Calculator";
import ProjectionDetail from "./ProjectionDetail";
import ProjectionsTable from "./ProjectionsTable";
import CashFlowView from "./CashFlowView";
import AssetView from "./AssetView";
import LiabilityView from "./LiabilityView";
import CashFlowProjection from "./CashFlowProjection";
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
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);

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
        const [inc, exp, ast, lib] = await Promise.all([
          CashFlowService.list(true),
          CashFlowService.list(false),
          AssetService.list(),
          LiabilityService.list(),
        ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
        setAssets(ast.data || []);
        setLiabilities(lib.data || []);
      } catch (e) {
        console.error("Failed to load cashflow, assets, or liabilities", e);
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

  const refreshAssets = async () => {
    const ast = await AssetService.list();
    setAssets(ast.data || []);
  };

  const refreshLiabilities = async () => {
    const lib = await LiabilityService.list();
    setLiabilities(lib.data || []);
  };

  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h3>Dashboard</h3>
            <button 
              className={`nav-btn ${view === 'home' ? 'active' : ''}`} 
              onClick={() => { setView('home'); setCashFlowView(null); }}
            >
              Home
            </button>
          </section>

          <section className="nav-section">
            <h3>Balance Sheet</h3>
            <button
              className={`nav-btn ${view === 'assets' ? 'active' : ''}`}
              onClick={() => { setView('assets'); setCashFlowView(null); }}
            >
              Assets
            </button>
            <button
              className={`nav-btn ${view === 'liabilities' ? 'active' : ''}`}
              onClick={() => { setView('liabilities'); setCashFlowView(null); }}
            >
              Liabilities
            </button>
          </section>

          <section className="nav-section">
            <h3>Cash Flow</h3>
            <button
              className={`nav-btn ${view === 'cashflow-projection' ? 'active' : ''}`}
              onClick={() => { setView('cashflow-projection'); setCashFlowView(null); }}
            >
              Cash Flow Projection
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'expense' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expense'); }}
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
              onViewProjection={handleViewProjection} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
            />
          </div>
        )}
        {!loading && view === "calculator" && (
          <div className="calculator">
            <h2>{editingProjection ? "Edit Projection" : "New Projection"}</h2>
            <Calculator 
              editingProjection={editingProjection} 
              onProjectionCreated={handleProjectionCreated}
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
            <CashFlowView 
              type={cashFlowView}
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              refreshCashflow={refreshCashflow}
            />
          </div>
        )}
        {!loading && view === "assets" && (
          <div className="assets-view">
            <AssetView 
              assets={assets}
              refreshAssets={refreshAssets}
            />
          </div>
        )}
        {!loading && view === "liabilities" && (
          <div className="liabilities-view">
            <LiabilityView 
              liabilities={liabilities}
              refreshLiabilities={refreshLiabilities}
            />
          </div>
        )}
        {!loading && view === "cashflow-projection" && (
          <div className="cashflow-projection-view">
            <CashFlowProjection />
          </div>
        )}
        {!loading && view === "settings" && (
          <div className="settings">
            <h2>Settings</h2>
            <SettingsModal 
              onClose={() => setView('home')} 
              isOpen={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
