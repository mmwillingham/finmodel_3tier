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
// import CashFlowProjection from "./CashFlowProjection"; // Removed as content is split
import BalanceSheetProjection from "./BalanceSheetProjection"; // New import
import CashFlowOverview from "./CashFlowOverview"; // New import
import SettingsModal from "./SettingsModal";
import "./SidebarLayout.css";
import SettingsService from "../services/settings.service"; // Added for projectionYears

export default function SidebarLayout() {
  const [view, setView] = useState("new-home"); // New default view
  const [cashFlowView, setCashFlowView] = useState(null);
  // Keep projections state and related functions for now, might be needed by ProjectionDetail if it's kept as a sub-view
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [editingProjection, setEditingProjection] = useState(null);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [projectionYears, setProjectionYears] = useState(30); // Added for new components

  // Keep loading cashflow, assets, and liabilities as they are part of the new dashboard views
  useEffect(() => {
    const load = async () => {
      try {
        // if (!loading) setLoading(true); // Removed as initial loading state is now managed better
        const [inc, exp, ast, lib, settingsRes] = await Promise.all([
          CashFlowService.list(true),
          CashFlowService.list(false),
          AssetService.list(),
          LiabilityService.list(),
          SettingsService.getSettings(), // Fetch settings for projectionYears
        ]);
        setIncomeItems(inc.data || []);
        setExpenseItems(exp.data || []);
        setAssets(ast.data || []);
        setLiabilities(lib.data || []);
        setProjectionYears(settingsRes.data.projection_years || 30); // Set projection years
      } catch (e) {
        console.error("Failed to load cashflow, assets, or liabilities", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const refreshCashflow = async () => {
    // Only fetch if not already in loading state
    if (!loading) setLoading(true);
    const [inc, exp] = await Promise.all([
      CashFlowService.list(true),
      CashFlowService.list(false),
    ]);
    setIncomeItems(inc.data || []);
    setExpenseItems(exp.data || []);
    setLoading(false);
  };

  const refreshAssets = async () => {
    // Only fetch if not already in loading state
    if (!loading) setLoading(true);
    const ast = await AssetService.list();
    setAssets(ast.data || []);
    setLoading(false);
  };

  const refreshLiabilities = async () => {
    // Only fetch if not already in loading state
    if (!loading) setLoading(true);
    const lib = await LiabilityService.list();
    setLiabilities(lib.data || []);
    setLoading(false);
  };

  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <section className="nav-section">
            <h3>Dashboard</h3>
            <button 
              className={`nav-btn ${view === 'new-home' ? 'active' : ''}`} 
              onClick={() => { setView('new-home'); setCashFlowView(null); }}
            >
              Home
            </button>
            
            <button
              className={`nav-btn ${view === 'balance-sheet-projection' ? 'active' : ''}`}
              onClick={() => { setView('balance-sheet-projection'); setCashFlowView(null); }}
            >
              Balance Sheet Projections
            </button>
            
            <button
              className={`nav-btn ${view === 'cashflow-projection' ? 'active' : ''}`}
              onClick={() => { setView('cashflow-projection'); setCashFlowView(null); }}
            >
              Cash Flow Projections
            </button>
          </section>

          <section className="nav-section">
            <h3>Items Management</h3>
            <button
              className={`nav-btn ${view === 'assets' ? 'active' : ''}`}
              onClick={() => { setView('assets'); setCashFlowView(null); }}
            >
              Asset Items
            </button>
            <button
              className={`nav-btn ${view === 'liabilities' ? 'active' : ''}`}
              onClick={() => { setView('liabilities'); setCashFlowView(null); }}
            >
              Liability Items
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'income' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('income'); }}
            >
              Income Items
            </button>
            <button
              className={`nav-btn ${view === 'cashflow' && cashFlowView === 'expense' ? 'active' : ''}`}
              onClick={() => { setView('cashflow'); setCashFlowView('expense'); }}
            >
              Expense Items
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
        
        {!loading && view === "new-home" && (
          <div className="dashboard-welcome">
            <h2>Welcome to the Financial Projector!</h2>
            <p>Use the navigation on the left to explore your financial data.</p>
          </div>
        )}

        {/* Projection Detail might still be needed if accessed directly or via a new component */}
        {!loading && view === "detail" && selectedProjectionId && (
          <div className="projection-detail">
            <h2>Projection Detail</h2>
            <ProjectionDetail 
              projectionId={selectedProjectionId} 
              onBack={() => setView("new-home")}
            />
          </div>
        )}

        {!loading && view === "balance-sheet-projection" && (
          <div className="balance-sheet-projection-wrapper">
            <BalanceSheetProjection 
              assets={assets}
              liabilities={liabilities}
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {!loading && view === "cashflow-projection" && (
          <div className="cashflow-overview-wrapper">
            <CashFlowOverview
              incomeItems={incomeItems}
              expenseItems={expenseItems}
              projectionYears={projectionYears}
              formatCurrency={formatCurrency}
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

        {!loading && view === "settings" && (
          <div className="settings">
            <h2>Settings</h2>
            <SettingsModal 
              onClose={() => setView('new-home')} 
              isOpen={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
