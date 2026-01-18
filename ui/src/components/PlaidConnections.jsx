import React, { useState, useEffect } from "react";
import PlaidService from "../services/plaid.service";
import AssetService from "../services/asset.service";
import "./PlaidLinkButton.css";

/**
 * PlaidConnections Component
 * 
 * Displays and manages connected Plaid accounts.
 * Allows users to sync accounts and disconnect items.
 */
function PlaidConnections({ onSyncSuccess }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({});
  const [error, setError] = useState(null);

  // Fetch connected items
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await PlaidService.listItems();
      setItems(response.data || []);
    } catch (err) {
      console.error("Error loading Plaid items:", err);
      setError("Failed to load connected accounts.");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (itemId) => {
    try {
      setSyncing((prev) => ({ ...prev, [itemId]: true }));
      setError(null);

      const response = await PlaidService.syncAccounts(itemId);
      
      console.log("Accounts synced:", response.data);

      // Call success callback to refresh assets
      if (onSyncSuccess) {
        onSyncSuccess(response.data);
      }

      // Show success message
      alert(`Successfully synced ${response.data.accounts_synced} account(s). ${response.data.assets_created_or_updated} asset(s) created or updated.`);
    } catch (err) {
      console.error("Error syncing accounts:", err);
      const errorMessage = err.response?.data?.detail || "Failed to sync accounts. Please try again.";
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setSyncing((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDisconnect = async (itemId) => {
    if (!window.confirm("Are you sure you want to disconnect this account? You'll need to reconnect it to sync again.")) {
      return;
    }

    try {
      await PlaidService.deleteItem(itemId);
      setItems((prev) => prev.filter((item) => item.item_id !== itemId));
      alert("Account disconnected successfully.");
    } catch (err) {
      console.error("Error disconnecting account:", err);
      const errorMessage = err.response?.data?.detail || "Failed to disconnect account.";
      alert(errorMessage);
    }
  };

  if (loading) {
    return <div>Loading connected accounts...</div>;
  }

  if (items.length === 0) {
    return null; // Don't show anything if no connections
  }

  return (
    <div className="plaid-connections">
      <h3 style={{ marginBottom: "15px", fontSize: "1.2rem" }}>Connected Bank Accounts</h3>
      
      {error && (
        <div className="plaid-error">
          <p style={{ color: "#dc3545", margin: 0 }}>{error}</p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.item_id} className="plaid-connection-item">
          <div className="plaid-connection-info">
            <div className="plaid-connection-name">
              {item.institution_name || "Connected Institution"}
            </div>
            <div className="plaid-connection-meta">
              Connected: {new Date(item.created_at).toLocaleDateString()}
              {item.last_successful_update && (
                <> • Last synced: {new Date(item.last_successful_update).toLocaleDateString()}</>
              )}
            </div>
          </div>
          <div className="plaid-connection-actions">
            <button
              className="btn-primary-modern"
              onClick={() => handleSync(item.item_id)}
              disabled={syncing[item.item_id]}
              style={{ fontSize: "0.9em", padding: "6px 12px" }}
            >
              {syncing[item.item_id] ? "Syncing..." : "Sync Now"}
            </button>
            <button
              className="btn-primary-modern"
              onClick={() => handleDisconnect(item.item_id)}
              style={{
                fontSize: "0.9em",
                padding: "6px 12px",
                backgroundColor: "#dc3545",
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PlaidConnections;
