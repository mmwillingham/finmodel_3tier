import React, { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import PlaidService from "../services/plaid.service";
import AssetService from "../services/asset.service";
import PlaidAccountMappingModal from "./PlaidAccountMappingModal";
import "./PlaidLinkButton.css";

/**
 * PlaidLinkButton Component
 * 
 * A button that opens Plaid Link to connect bank accounts.
 * After successful connection, it automatically syncs accounts to create assets.
 */
function PlaidLinkButton({ onSuccess, onError }: any) {
  const [linkToken, setLinkToken] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<any>(null);
  const [accountPreviews, setAccountPreviews] = useState<any[]>([]);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        setLoading(true);
        const response = await PlaidService.getLinkToken();
        setLinkToken(response.data.link_token);
      } catch (err: any) {
        // Check if Plaid is not configured (503 error)
        if (err.response?.status === 503) {
          // Plaid not configured - component will show a message instead of button
          setError(null);
          setLinkToken(null);
        } else {
          setError("Failed to initialize Plaid. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLinkToken();
  }, []);

  // Handle successful Plaid Link connection
  const handleSuccess = async (publicToken: any, metadata: any) => {
    try {
      setLoading(true);
      setError(null);

      // Exchange public token for access token
      const exchangeResponse = await PlaidService.exchangePublicToken(publicToken);
      const itemId = exchangeResponse.data.item_id;

      // Preview accounts for mapping
      const previewResponse = await PlaidService.previewAccounts(itemId);
      const accounts = previewResponse.data;
      
      if (accounts && accounts.length > 0) {
        // Show mapping modal
        setCurrentItemId(itemId);
        setAccountPreviews(accounts);
        setShowMappingModal(true);
      } else {
        // No accounts to map, just call success
        if (onSuccess) {
          onSuccess({ status: 'success', items: [] });
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "Failed to connect account. Please try again.";
      setError(errorMessage);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMappingSuccess = (result: any) => {
    setShowMappingModal(false);
    setCurrentItemId(null);
    setAccountPreviews([]);
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess(result);
    }
  };

  const handleMappingClose = () => {
    setShowMappingModal(false);
    setCurrentItemId(null);
    setAccountPreviews([]);
  };

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err: any, metadata: any) => {
      if (err) {
        setError(err.error_message || "Connection cancelled.");
      }
      setLoading(false);
    },
  });

  const handleClick = () => {
    if (ready && linkToken) {
      open();
    }
  };

  // If Plaid is not configured (no link token and no error after loading), show a message
  if (!linkToken && !error && !loading) {
    return (
      <div style={{ 
        padding: '12px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffc107', 
        borderRadius: '4px',
        color: '#856404'
      }}>
        <p style={{ margin: 0, fontSize: '0.9em' }}>
          ⚠️ Plaid integration is not configured. Please contact your administrator to enable bank account connections.
        </p>
      </div>
    );
  }

  // Show error message if any (only for actual errors, not "not configured")
  if (error && !loading) {
    return (
      <div className="plaid-error">
        <p style={{ color: "#dc3545", marginBottom: "10px" }}>{error}</p>
        <button
          className="btn-primary-modern"
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        className="btn-primary-modern plaid-connect-btn"
        onClick={handleClick}
        disabled={!ready || loading || !linkToken}
        style={{
          opacity: (!ready || loading || !linkToken) ? 0.6 : 1,
          cursor: (!ready || loading || !linkToken) ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ marginRight: "8px" }}>⏳</span>
            Connecting...
          </>
        ) : (
          <>
            <span style={{ marginRight: "8px" }}>🏦</span>
            Connect Bank Account
          </>
        )}
      </button>
      
      {showMappingModal && currentItemId && (
        <PlaidAccountMappingModal
          itemId={currentItemId}
          accounts={accountPreviews}
          onClose={handleMappingClose}
          onSuccess={handleMappingSuccess}
        />
      )}
    </>
  );
}

export default PlaidLinkButton;
