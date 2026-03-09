import React, { useState, useEffect, useRef, useMemo } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import CashFlowService from "../services/cashflow.service";
import CashFlowFormModal from "./CashFlowFormModal"; // Import the new modal form
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from '../context/AuthContext';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import { buildTaxableDistributionEntries } from '../utils/taxableDistribution';
import "./CashFlowView.css";
import TaxService from "../services/tax.service";

type CashFlowItem = Record<string, any>;
type CashFlowType = 'income' | 'expense';
type SortKey = string | null;

interface CashFlowViewProps {
  type: CashFlowType;
  incomeItems?: CashFlowItem[];
  expenseItems?: CashFlowItem[];
  refreshCashflow: () => Promise<void> | void;
  validCategories?: string[];
  assets?: Record<string, any>[];
  autoDisbursements?: Record<string, any>[];
}

interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  onConfirm: null | (() => Promise<void> | void);
  title: string;
}

export default function CashFlowView({
  type,
  incomeItems = [],
  expenseItems = [],
  refreshCashflow,
  validCategories = [],
  assets = [],
  autoDisbursements = [],
}: CashFlowViewProps) {
  const { userSettings } = useAuth();
  const typedUserSettings: any = userSettings;
  
  // Use memo to ensure items update when props change
  const items = useMemo(() => {
    return type === 'income' ? [...(incomeItems || [])] : [...(expenseItems || [])];
  }, [type, incomeItems, expenseItems]);
  const currentYear = new Date().getFullYear();

  const derivedIncomeItems = useMemo<any[]>(() => {
    if (type !== 'income') {
      return [];
    }
    return buildTaxableDistributionEntries({
      autoDisbursements,
      assets,
      currentYear,
      targetYear: 0,
      userSettings,
      includeInactive: true,
    });
  }, [autoDisbursements, assets, currentYear, type, userSettings]);

  const displayedItems: any[] = type === 'income' ? [...items, ...derivedIncomeItems] : items;

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CashFlowItem | null>(null); // State to hold item being edited
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  const tableRef = useRef<HTMLTableElement | null>(null);
  const [stateTaxValue, setStateTaxValue] = useState<number | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const remove = async (id: number | string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: 'Delete this item?',
      onConfirm: async () => {
        await CashFlowService.delete(String(id));
        await refreshCashflow();
      }
    });
  };

  const handleEditClick = (item: CashFlowItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleNewItemClick = () => {
    setEditingItem(null); // No item for new entry
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingItem(null); // Clear editing item on close
  };

  const handleSaveSuccess = () => {
    refreshCashflow(); // Refresh the list after a successful save/update
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = [...displayedItems].sort((a: any, b: any) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle null/undefined values
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    // Handle person field - treat null as 'Family'
    if (sortConfig.key === 'person') {
      aValue = aValue || 'Family';
      bValue = bValue || 'Family';
    }

    // Handle numeric values
    if (['yearly_value', 'annual_increase_percent', 'inflation_percent'].includes(sortConfig.key)) {
      aValue = parseFloat(String(aValue)) || 0;
      bValue = parseFloat(String(bValue)) || 0;
    }

    // Handle boolean values
    if (sortConfig.key === 'taxable' || sortConfig.key === 'tax_deductible') {
      aValue = aValue ? 'Yes' : 'No';
      bValue = bValue ? 'Yes' : 'No';
    }

    // Handle dynamic field
    if (sortConfig.key === 'linked_item_id') {
      aValue = aValue ? 'Yes' : 'No';
      bValue = bValue ? 'Yes' : 'No';
    }

    // Handle frequency
    if (sortConfig.key === 'frequency') {
      const freqMap: Record<string, string> = { 'monthly': 'Monthly', 'yearly': 'Yearly', 'one-time': 'One-time' };
      aValue = freqMap[aValue] || aValue;
      bValue = freqMap[bValue] || bValue;
    }

    // Compare values
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const total = displayedItems.reduce((sum: any, item: any) => sum + (item.yearly_value || 0), 0);

  // Count items with missing fields and auto-generated items
  const itemStats = displayedItems.reduce((stats: any, item: any) => {
          const isSocialSecurity = item.description?.startsWith("Social Security - ");
          const isCalculatedTaxItem = item.description === "Federal Income Tax (Calculated)";
          const isStateTaxItem = item.description === "State Income Tax (Calculated)";
          const isSyntheticTaxableDistribution = !!item.syntheticTaxableDistribution;
          const isAutoGenerated = isSyntheticTaxableDistribution || isSocialSecurity || isCalculatedTaxItem || isStateTaxItem || (item.linked_item_type === "asset" && 
                                  (item.linked_item_id || (item.linked_asset_ids && item.linked_asset_ids.length > 0)));
    const categoryValue = item.category && typeof item.category === 'string' ? item.category.trim() : (item.category || '');
    const categoryMissing = !categoryValue || (!isAutoGenerated && validCategories.length > 0 && !validCategories.includes(categoryValue));
    const descriptionMissing = !item.description || (typeof item.description === 'string' && item.description.trim() === '');
    const valueMissing = !isCalculatedTaxItem && !isStateTaxItem && !isAutoGenerated && (item.yearly_value === null || item.yearly_value === undefined);
    const hasMissingFields = categoryMissing || descriptionMissing || valueMissing;
    
    if (hasMissingFields) {
      stats.missingFields++;
    }
    if (isAutoGenerated && !hasMissingFields) {
      stats.autoGenerated++;
    }
    
    return stats;
  }, { missingFields: 0, autoGenerated: 0 });

  // Download functions (remain unchanged)
  const handleDownloadTablePdf = async (tableRef: React.RefObject<HTMLTableElement | null>, filename: string) => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
    }
  };

  const convertToCsv = (
    dataArray: Array<Record<string, any>>,
    headers: string[],
    valueFormatter?: (value: number) => string
  ) => {
    const csvRows: string[] = [];
    csvRows.push(headers.join(','));

    dataArray.forEach((row: Record<string, any>) => {
      const values = headers.map((header: any) => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadCashFlowTableCsv = (filename: string) => {
    if (displayedItems.length > 0) {
      let headers = ['Category', 'Description', 'Person', 'Frequency', 'Yearly Value', 'Start Date', 'End Date'];
      if (type === 'income') {
        headers = [...headers, 'Annual Increase %', 'Taxable'];
      } else if (type === 'expense') {
        headers = [...headers, 'Inflation %', 'Tax Deductible'];
      }

      const formattedData = displayedItems.map((item: any) => {
        const row: any = {
          Category: item.category,
          Description: item.description,
          Person: item.person || 'Family',
          Frequency: item.frequency === 'monthly' ? 'Monthly' : 'Yearly',
          'Yearly Value': item.yearly_value,
          'Start Date': item.start_date || '-',
          'End Date': item.end_date || 'No end date',
        };
        if (type === 'income') {
          row['Annual Increase %'] = item.annual_increase_percent;
          row.Taxable = item.taxable ? 'Yes' : 'No';
        } else if (type === 'expense') {
          row['Inflation %'] = item.inflation_percent;
          row['Tax Deductible'] = item.tax_deductible ? 'Yes' : 'No';
        }
        return row;
      });

      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
    }
  };

  const shouldFetchStateTax = type === 'expense' && userSettings?.calculate_state_tax && userSettings?.state;
  useEffect(() => {
    let cancelled = false;
    if (!shouldFetchStateTax) {
      setStateTaxValue(null);
      return;
    }

    TaxService.calculateStateTax()
      .then((response: any) => {
        if (!cancelled) {
          setStateTaxValue(response.data.state_tax ?? null);
        }
      })
      .catch((error: any) => {
        if (!cancelled) {
          setStateTaxValue(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    shouldFetchStateTax,
    incomeItems.length,
    expenseItems.length,
    userSettings?.state,
    userSettings?.tax_filing_status,
  ]);

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>{type === 'income' ? 'Income' : 'Expenses'}</h2>

      {/* New button to open the modal for adding a new item */}
      <div className="add-new-item-section">
        <button onClick={handleNewItemClick} className="add-new-item-button">
          Add New {type === 'income' ? 'Income' : 'Expense'} Item
        </button>
      </div>

      <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
        <button className="btn-primary-modern" onClick={() => handleDownloadTablePdf(tableRef, `${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download PDF</button>
        <button className="btn-primary-modern" onClick={() => handleDownloadCashFlowTableCsv(`${type === 'income' ? 'Income' : 'Expenses'}_Table`)}>Download CSV</button>
      </div>

      {/* Conditional headers for missing fields and auto-generated items */}
      {(itemStats.missingFields > 0 || itemStats.autoGenerated > 0) && (
        <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {itemStats.missingFields > 0 && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: 'rgba(245, 158, 11, 0.18)', 
              borderLeft: '4px solid #f59e0b',
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#fef3c7',
              fontWeight: '500'
            }}>
              Items missing required fields: {itemStats.missingFields}
            </div>
          )}
          {itemStats.autoGenerated > 0 && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: 'rgba(56, 189, 248, 0.16)', 
              borderLeft: '4px solid #38bdf8',
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#7dd3fc',
              fontWeight: '500'
            }}>
              Items auto-generated: {itemStats.autoGenerated}
            </div>
          )}
        </div>
      )}
      <div className="table-scroll">
        <table ref={tableRef} className="cashflow-table" style={{ width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {[
              <th key="category" className="cashflow-table-cell sortable" style={{ width: '8%' }} onClick={() => handleSort('category')}>
                Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="description" className="cashflow-table-cell sortable" style={{ width: '15%' }} onClick={() => handleSort('description')}>
                Description {sortConfig.key === 'description' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="person" className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('person')}>
                Person {sortConfig.key === 'person' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="frequency" className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('frequency')}>
                Freq {sortConfig.key === 'frequency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="yearly_value" className="cashflow-table-cell sortable" style={{ width: '10%' }} onClick={() => handleSort('yearly_value')}>
                Yearly Value {sortConfig.key === 'yearly_value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="start_date" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('start_date')}>
                Start Date {sortConfig.key === 'start_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="end_date" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('end_date')}>
                End Date {sortConfig.key === 'end_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              <th key="linked_item_id" className="cashflow-table-cell sortable" style={{ width: '6%' }} onClick={() => handleSort('linked_item_id')}>
                Dyn {sortConfig.key === 'linked_item_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>,
              ...(type === 'income' ? [
                <th key="annual_increase_percent" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('annual_increase_percent')}>
                  Pct {sortConfig.key === 'annual_increase_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="taxable" className="cashflow-table-cell sortable" style={{ width: '6%' }} onClick={() => handleSort('taxable')}>
                  Tax {sortConfig.key === 'taxable' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
              ] : []),
              ...(type === 'expense' ? [
                <th key="inflation_percent" className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('inflation_percent')}>
                  Inf % {sortConfig.key === 'inflation_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
                <th key="tax_deductible" className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('tax_deductible')}>
                  Ded {sortConfig.key === 'tax_deductible' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>,
              ] : []),
              <th key="actions" className="cashflow-table-cell" style={{ width: '8%' }}>Actions</th>,
            ]}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item: any) => {
            // Check if item is auto-generated (linked to an asset, Social Security, or Federal Tax)
            const isSocialSecurity = item.description?.startsWith("Social Security - ");
            const isCalculatedTaxItem = item.description === "Federal Income Tax (Calculated)";
            const isStateTaxItem = item.description === "State Income Tax (Calculated)";
            const isAutoGenerated = isSocialSecurity || isCalculatedTaxItem || isStateTaxItem || (item.linked_item_type === "asset" && 
                                    (item.linked_item_id || (item.linked_asset_ids && item.linked_asset_ids.length > 0)));
            
            // Calculate yearly value for auto-generated items (only for asset-linked items, not Social Security)
            // Also calculate for Federal Income Tax expense item
            let calculatedYearlyValue = item.yearly_value;
            
            if (isCalculatedTaxItem && userSettings && type === 'expense') {
              // Calculate current year federal tax
              try {
                const currentYear = new Date().getFullYear();
                
                // Sum taxable income
                const totalTaxableIncome = (incomeItems || []).reduce((sum: any, incomeItem: any) => {
                  if (incomeItem.taxable && incomeItem.yearly_value) {
                    return sum + (incomeItem.yearly_value || 0);
                  }
                  return sum;
                }, 0);
                
                // Sum tax-deductible expenses (excluding the Federal Income Tax expense item itself)
                const totalTaxDeductibleExpenses = (expenseItems || []).reduce((sum: any, expenseItem: any) => {
                  if (expenseItem.description !== "Federal Income Tax (Calculated)" && expenseItem.tax_deductible && expenseItem.yearly_value) {
                    return sum + (expenseItem.yearly_value || 0);
                  }
                  return sum;
                }, 0);
                
                const taxResult = calculateTaxableIncome(
                  totalTaxableIncome,
                  totalTaxDeductibleExpenses,
                  typedUserSettings?.tax_filing_status || "Single",
                  typedUserSettings?.person1_birthdate,
                  typedUserSettings?.person2_birthdate,
                  currentYear
                );
                
                calculatedYearlyValue = Math.round(taxResult.taxOwed || 0);
              } catch (error: any) {
                calculatedYearlyValue = item.yearly_value || 0;
              }
            } else if (isStateTaxItem) {
              if (stateTaxValue !== null && stateTaxValue !== undefined) {
                calculatedYearlyValue = stateTaxValue;
              }
            } else if (!isSocialSecurity && isAutoGenerated && item.percentage !== null && item.percentage !== undefined) {
              if (item.linked_asset_ids && item.linked_asset_ids.length > 0) {
                // Multi-select: sum values from all linked assets
                const linkedAssets = assets.filter((asset: any) => item.linked_asset_ids.includes(asset.id));
                const totalAssetValue = linkedAssets.reduce((sum: any, asset: any) => sum + (asset.value || 0), 0);
                calculatedYearlyValue = totalAssetValue * (item.percentage / 100.0);
              } else if (item.linked_item_id) {
                // Single linked asset (backward compatibility)
                const linkedAsset = assets.find((asset: any) => asset.id === item.linked_item_id);
                if (linkedAsset) {
                  calculatedYearlyValue = (linkedAsset.value || 0) * (item.percentage / 100.0);
                }
              }
            }
            
            // Check for missing required fields - handle empty strings, whitespace, and invalid categories
            const categoryValue = item.category && typeof item.category === 'string' ? item.category.trim() : (item.category || '');
            // For auto-generated items, don't validate against validCategories since they may use system categories like "Interest" or "Dividends"
            const categoryMissing = !categoryValue || (!isAutoGenerated && validCategories.length > 0 && !validCategories.includes(categoryValue));
            const descriptionMissing = !item.description || (typeof item.description === 'string' && item.description.trim() === '');
            
            // Skip value validation for "Federal Income Tax (Calculated)", "State Income Tax (Calculated)", and auto-generated items since they're calculated dynamically
            // Note: isCalculatedTaxItem and isStateTaxItem are already declared above in the calculation section
            // Note: value of 0 is allowed (TESTING_PLAN.md test 2.4 assumes 0 is valid)
            const valueMissing = !isCalculatedTaxItem && !isStateTaxItem && !isAutoGenerated && (item.yearly_value === null || item.yearly_value === undefined);
            const hasMissingFields = categoryMissing || descriptionMissing || valueMissing;
            
            // Check if linked asset(s) are missing (for income items linked to assets)
            let hasMissingLinkedAsset = false;
            if (type === 'income' && item.linked_item_type === "asset") {
              if (item.linked_asset_ids && item.linked_asset_ids.length > 0) {
                // Multi-select: check if all linked assets exist
                const linkedAssets = assets.filter((asset: any) => item.linked_asset_ids.includes(asset.id));
                hasMissingLinkedAsset = linkedAssets.length < item.linked_asset_ids.length;
              } else if (item.linked_item_id) {
                // Single linked asset (backward compatibility)
                const linkedAsset = assets.find((asset: any) => asset.id === item.linked_item_id);
                hasMissingLinkedAsset = !linkedAsset;
              }
            }
            
            // Different colors for different states
            let rowStyle = {};
            if (hasMissingLinkedAsset) {
              // Missing linked asset (warning) - keep contrast on dark surfaces
              rowStyle = { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderLeft: '4px solid #f59e0b' };
            } else if (isAutoGenerated && !hasMissingFields) {
              // Auto-generated items (cool accent)
              rowStyle = { backgroundColor: 'rgba(56, 189, 248, 0.16)', borderLeft: '4px solid #38bdf8' };
            } else if (hasMissingFields) {
              // Missing required fields (warning)
              rowStyle = { backgroundColor: 'rgba(245, 158, 11, 0.18)', borderLeft: '4px solid #f59e0b' };
            }
            
            const missingFields = [
              categoryMissing && 'Category', 
              descriptionMissing && 'Description', 
              valueMissing && 'Value'
            ].filter(Boolean);
            
            const tooltip = hasMissingLinkedAsset
              ? 'Linked asset has been deleted'
              : hasMissingFields 
                ? 'Missing required fields: ' + missingFields.join(', ')
                : isCalculatedTaxItem
                  ? 'Auto-generated Federal Income Tax expense (value calculated dynamically)'
                : isStateTaxItem
                  ? 'Auto-generated State Income Tax expense (value calculated dynamically)'
                : isSocialSecurity
                  ? 'Auto-generated Social Security income item'
                : isAutoGenerated 
                  ? 'Auto-generated from linked asset (value calculated dynamically)'
                  : '';
            
            return (
              <tr key={item.id} style={rowStyle} title={tooltip}>
                {[
                  <td key="category" className="cashflow-table-cell">{categoryValue ? item.category : <span style={{ color: '#dc3545', fontStyle: 'italic', fontWeight: 'bold' }}>Missing: Category</span>}</td>,
                  <td key="description" className="cashflow-table-cell">{item.description && item.description.trim() ? item.description : <span style={{ color: '#dc3545', fontStyle: 'italic', fontWeight: 'bold' }}>Missing: Description</span>}</td>,
                  <td key="person" className="cashflow-table-cell">{item.person || 'Family'}</td>,
                  <td key="frequency" className="cashflow-table-cell">{item.frequency === 'monthly' ? 'Monthly' : item.frequency === 'one-time' ? 'One-time' : 'Yearly'}</td>,
                  <td key="yearly_value" className="cashflow-table-cell">{formatCurrency((isAutoGenerated || isCalculatedTaxItem || isStateTaxItem) ? calculatedYearlyValue : item.yearly_value)}</td>,
                  <td key="start_date" className="cashflow-table-cell">{item.start_date || '-'}</td>,
                  <td key="end_date" className="cashflow-table-cell">{item.end_date || 'No end date'}</td>,
                  <td key="linked" className="cashflow-table-cell">{(item.linked_item_id || (item.linked_asset_ids && item.linked_asset_ids.length > 0)) ? 'Yes' : 'No'}</td>,
                  ...(type === 'income' ? [
                    <td key="annual_increase_percent" className="cashflow-table-cell">
                      {isAutoGenerated && item.percentage !== null && item.percentage !== undefined
                        ? `${item.percentage}%`
                        : `${item.annual_increase_percent || 0}%`}
                    </td>,
                    <td key="taxable" className="cashflow-table-cell">{item.taxable ? 'Yes' : 'No'}</td>,
                  ] : []),
                  ...(type === 'expense' ? [
                    <td key="inflation_percent" className="cashflow-table-cell">{item.inflation_percent}%</td>,
                    <td key="tax_deductible" className="cashflow-table-cell">{item.tax_deductible ? 'Yes' : 'No'}</td>,
                  ] : []),
                  <td key="actions" className="action-buttons-cell">
                    {!item.syntheticTaxableDistribution ? (
                      <>
                        <button onClick={() => handleEditClick(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                        <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
                      </>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Auto-generated</span>
                    )}
                  </td>,
                ]}
              </tr>
            );
          })}
        </tbody>
        
      </table>
      </div>

      <div className="total">
        <strong>Total {type === 'income' ? 'Income' : 'Expenses'} (Yearly): {formatCurrency(total)}</strong>
      </div>

      {/* Render the CashFlowFormModal */}
      <CashFlowFormModal
        isOpen={showModal}
        onClose={handleModalClose}
        item={editingItem}
        type={type}
        onSaveSuccess={handleSaveSuccess}
        incomeItems={incomeItems}
        expenseItems={expenseItems}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}