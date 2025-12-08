import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectionService from ".../projection.service";

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

const Calculator = () => {
    // State to hold the dynamic list of accounts
    const [accounts, setAccounts] = useState([
        { ...DEFAULT_ACCOUNT, name: "Main Savings", initial_balance: 10000, monthly_contribution: 200, annual_rate_percent: 4.5 },
        { ...DEFAULT_ACCOUNT, name: "Retirement IRA", initial_balance: 25000, monthly_contribution: 500, annual_rate_percent: 8.5 },
    ]);
    
    // State for global inputs
    const [projectionName, setProjectionName] = useState("My New Plan");
    const [years, setYears] = useState(25);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    // --- Account Management Functions ---

    const addAccount = () => {
        if (accounts.length < 8) {
            setAccounts([...accounts, { ...DEFAULT_ACCOUNT, name: `Account ${accounts.length + 1}` }]);
        } else {
            setMessage("Maximum of 8 accounts reached.");
        }
    };

    const removeAccount = (indexToRemove) => {
        if (accounts.length > 1) {
            setAccounts(accounts.filter((_, index) => index !== indexToRemove));
        } else {
            setMessage("Must have at least one account.");
        }
    };

    const handleAccountChange = (index, field, value) => {
        const newAccounts = accounts.map((account, i) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("Calculating...");

        // 1. Format the data into the FastAPI ProjectionRequest schema
        const requestPayload = {
            plan_name: projectionName,
            years: years,
            accounts: accounts.map(acc => ({
                name: acc.name,
                type: acc.type,
                initial_balance: parseFloat(acc.initial_balance || 0),
                monthly_contribution: parseFloat(acc.monthly_contribution || 0),
                annual_rate_percent: parseFloat(acc.annual_rate_percent || 0),
            }))
        };
        
        // 2. Send the authenticated request to the secure API
        try {
            const response = await ProjectionService.createProjection(requestPayload);
            setMessage("Calculation successful! Redirecting to results...");
            
            // 3. On success, navigate to the detail view of the new projection
            navigate(`/projection/${response.id}`);

        } catch (error) {
            // 4. Handle errors (e.g., 401 Unauthorized, 400 Bad Request)
            const errorMsg = error.response?.data?.detail || "An unexpected error occurred.";
            setMessage(`Calculation Failed: ${errorMsg}`);
            console.error(error);
        }
    };

    // --- Rendering ---

    return (
        <div className="calculator-page">
            <h2>Financial Projection Calculator</h2>
            <form onSubmit={handleSubmit}>
                <div className="global-inputs">
                    <label>Plan Name:</label>
                    <input 
                        type="text" 
                        value={projectionName} 
                        onChange={(e) => setProjectionName(e.target.value)} 
                        required 
                    />
                    <label>Projection Years:</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="60" 
                        value={years} 
                        onChange={(e) => setYears(parseInt(e.target.value) || 0)} 
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
                {accounts.map((account, index) => (
                    <div key={index} className="account-grid input-row">
                        {/* 1. Name */}
                        <input
                            type="text"
                            value={account.name}
                            onChange={(e) => handleAccountChange(index, 'name', e.target.value)}
                            required
                        />
                        {/* 2. Type */}
                        <select
                            value={account.type}
                            onChange={(e) => handleAccountChange(index, 'type', e.target.value)}
                        >
                            {INVESTMENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        {/* 3. Balance */}
                        <input
                            type="number"
                            min="0"
                            step="100"
                            value={account.initial_balance}
                            onChange={(e) => handleAccountChange(index, 'initial_balance', e.target.value)}
                        />
                        {/* 4. Contribution */}
                        <input
                            type="number"
                            min="0"
                            step="50"
                            value={account.monthly_contribution}
                            onChange={(e) => handleAccountChange(index, 'monthly_contribution', e.target.value)}
                        />
                        {/* 5. Rate */}
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={account.annual_rate_percent}
                            onChange={(e) => handleAccountChange(index, 'annual_rate_percent', e.target.value)}
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
                    <button type="submit" className="calculate-btn" disabled={accounts.length === 0}>
                        🚀 Calculate & Save Projection
                    </button>
                </div>
            </form>
            {message && <div className="status-message">{message}</div>}
        </div>
    );
};

export default Calculator;
