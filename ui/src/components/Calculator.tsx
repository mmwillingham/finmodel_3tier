import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectionService from "../services/projection.service";

// Global constants matching your Python constants (simplified here)
const INVESTMENT_TYPES = [
    "--- Select Type ---",
    "Cash (Checking/Current)",
    "Savings (High-Yield)",
    "Brokerage (Taxable)",
    "Retirement (Tax-Advantaged)",
    "Real Estate",
    "Other/Custom"
];

const DEFAULT_ACCOUNT = {
    name: "New Account",
    type: INVESTMENT_TYPES[0],
    initial_balance: 0.0,
    monthly_contribution: 0.0,
    annual_rate_percent: 0.0,
};

const Calculator = ({ onProjectionCreated, editingProjection }: any) => {
    const [accounts, setAccounts] = useState([
        { ...DEFAULT_ACCOUNT, name: "Main Savings", initial_balance: 10000, monthly_contribution: 200, annual_rate_percent: 4.5 },
        { ...DEFAULT_ACCOUNT, name: "Retirement IRA", initial_balance: 25000, monthly_contribution: 500, annual_rate_percent: 8.5 },
    ]);
    
    const [projectionName, setProjectionName] = useState("My New Plan");
    const [years, setYears] = useState(25);
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<any>(null);
    const navigate = useNavigate();

    // Load edit data from prop instead of location.state
    useEffect(() => {
        if (editingProjection) {
            setProjectionName(editingProjection.name);
            setYears(editingProjection.years);
            setEditingId(editingProjection.id);
            setIsEditing(true);

            try {
                const data = JSON.parse(editingProjection.data_json || '[]');
                const accountsData = JSON.parse(editingProjection.accounts_json || '[]');
                
                if (accountsData.length > 0) {
                    // Normalize legacy keys and ensure defaults
                    const normalized = accountsData.map((acc: any) => ({
                        ...DEFAULT_ACCOUNT,
                        ...acc,
                        type: acc.type || acc.account_type || DEFAULT_ACCOUNT.type,
                        initial_balance: parseFloat(acc.initial_balance ?? acc.balance ?? 0) || 0,
                        monthly_contribution: parseFloat(acc.monthly_contribution ?? acc.contrib ?? 0) || 0,
                        annual_rate_percent: parseFloat(acc.annual_rate_percent ?? acc.rate ?? 0) || 0,
                    }));
                    setAccounts(normalized);
                } else if (data.length > 0) {
                    // Fallback legacy reconstruction
                    const firstYear = data[0];
                    const accountNames = Object.keys(firstYear)
                        .filter((key: any) => key.endsWith('_Value') && key !== 'Total_Value')
                        .map((key: any) => key.replace('_Value', ''));

                    const reconstructedAccounts = accountNames.map((name: any) => ({
                        ...DEFAULT_ACCOUNT,
                        name,
                        initial_balance: firstYear[`${name}_Value`] || 0,
                        type: DEFAULT_ACCOUNT.type,
                    }));
                    setAccounts(reconstructedAccounts);
                }
            } catch (e: any) {
            }
        }
    }, [editingProjection]);

    // --- Account Management Functions ---

    const addAccount = () => {
        if (accounts.length < 8) {
            setAccounts([...accounts, { ...DEFAULT_ACCOUNT, name: `Account ${accounts.length + 1}` }]);
        } else {
            setMessage("Maximum of 8 accounts reached.");
        }
    };

    const removeAccount = (indexToRemove: any) => {
        if (accounts.length > 1) {
            setAccounts(accounts.filter((_: any, index: any) => index !== indexToRemove));
        } else {
            setMessage("Must have at least one account.");
        }
    };

    const handleAccountChange = (index: any, field: any, value: any) => {
        const newAccounts = accounts.map((account: any, i: any) => {
            if (i === index) {
                // Parse number inputs correctly
                const parsedValue = (field === 'initial_balance' || field === 'monthly_contribution' || field === 'annual_rate_percent') 
                    ? parseFloat(value) || 0.0 
                    : value;
                return { ...account, [field]: parsedValue };
            }
            return account;
        });
        setAccounts(newAccounts);
    };

    // --- Submission Handler ---

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setMessage(isEditing ? "Updating..." : "Calculating...");

        const requestPayload = {
            plan_name: projectionName,
            years: years,
            accounts: accounts.map((acc: any) => ({
                name: acc.name,
                type: acc.type,
                initial_balance: Number(acc.initial_balance || 0),
                monthly_contribution: Number(acc.monthly_contribution || 0),
                annual_rate_percent: Number(acc.annual_rate_percent || 0),
            }))
        };
        
        try {
            let response;
            if (isEditing && editingId) {
                response = await ProjectionService.updateProjection(editingId, requestPayload);
                setMessage("Projection updated successfully!");
            } else {
                response = await ProjectionService.createProjection(requestPayload);
                setMessage("Projection created successfully!");
            }
            
            if (onProjectionCreated) {
                onProjectionCreated(response.id);
            } else {
                navigate(`/projection/${response.id}`);
            }

            // Notify auto-disbursements to refresh RMD values after projection run.
            window.dispatchEvent(new CustomEvent('rmdRefreshRequested', { detail: { source: 'projectionRun', projectionId: response.id } }));

        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || "An unexpected error occurred.";
            setMessage(`${isEditing ? 'Update' : 'Calculation'} Failed: ${errorMsg}`);
        }
    };

    // --- Reset Form Handler ---

    const resetForm = () => {
        setProjectionName("My New Plan");
        setYears(25);
        setAccounts([
            { ...DEFAULT_ACCOUNT, name: "Main Savings", initial_balance: 10000, monthly_contribution: 200, annual_rate_percent: 4.5 },
            { ...DEFAULT_ACCOUNT, name: "Retirement IRA", initial_balance: 25000, monthly_contribution: 500, annual_rate_percent: 8.5 },
        ]);
        setIsEditing(false);
        setEditingId(null);
        setMessage('');
    };

    // --- Rendering ---

    return (
        <div className="calculator-page">
            <h2>{isEditing ? 'Edit Projection' : 'Model My Retirement Projection Calculator'}</h2>
            <form onSubmit={handleSubmit}>
                <div className="global-inputs">
                    <label>Plan Name:</label>
                    <input 
                        type="text" 
                        value={projectionName} 
                        onChange={(e: any) => setProjectionName(e.target.value)} 
                        required 
                    />
                    <label>Projection Years:</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="60" 
                        value={years} 
                        onChange={(e: any) => setYears(parseInt(e.target.value) || 0)} 
                        required 
                    />
                </div>

                <h3>Account Inputs ({accounts.length} Total)</h3>
                
                {/* Table Header */}
                <div className="account-grid header-row">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Balance ($)</span>
                    <span>Monthly Contrib ($)</span>
                    <span>Rate (%)</span>
                    <span>Action</span>
                </div>

                {/* Dynamic Account Rows */}
                {accounts.map((account: any, index: any) => (
                    <div key={index} className="account-grid input-row">
                        {/* 1. Name */}
                        <input
                            type="text"
                            value={account.name}
                            onChange={(e: any) => handleAccountChange(index, 'name', e.target.value)}
                            required
                        />
                        {/* 2. Type */}
                        <select
                            value={account.type || INVESTMENT_TYPES[0]}
                            onChange={(e: any) => handleAccountChange(index, 'type', e.target.value)}
                        >
                            {INVESTMENT_TYPES.map((type: any) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>

                        <input
                            type="number"
                            min="0"
                            // remove step so arbitrary numbers are allowed
                            value={account.initial_balance}
                            onFocus={(e: any) => e.target.select()}
                            onChange={(e: any) => handleAccountChange(index, 'initial_balance', e.target.value)}
                        />

                        <input
                            type="number"
                            min="0"
                            value={account.monthly_contribution}
                            onFocus={(e: any) => e.target.select()}
                            onChange={(e: any) => handleAccountChange(index, 'monthly_contribution', e.target.value)}
                        />

                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={account.annual_rate_percent}
                            onFocus={(e: any) => e.target.select()}
                            onChange={(e: any) => handleAccountChange(index, 'annual_rate_percent', e.target.value)}
                        />
                        {/* 6. Action */}
                        <button type="button" onClick={() => removeAccount(index)} className="remove-btn" disabled={accounts.length <= 1}>
                            Remove
                        </button>
                    </div>
                ))}
                
                {/* Action Buttons */}
                <div className="form-actions">
                    <button type="button" onClick={addAccount} className="add-btn">
                        + Add Account
                    </button>
                    <button type="submit" className="submit-btn">
                        {isEditing ? 'Save & Recalculate' : 'Calculate Projection'}
                    </button>
                </div>
            </form>
            {message && <div className="status-message">{message}</div>}
            {isEditing && (
                <button onClick={resetForm} className="reset-btn">
                    Cancel Edit / New Projection
                </button>
            )}
        </div>
    );
};

export default Calculator;
