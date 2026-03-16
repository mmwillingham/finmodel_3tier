import React, { useState, useRef, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AssetService from '../services/asset.service';
import AssetFormModal from './AssetFormModal';
import ConfirmDialog from './ConfirmDialog';
import './AssetView.css';

type Asset = {
  id: number;
  name?: string;
  category?: string;
  account_id?: number | null;
  value?: number | null;
  annual_increase_percent?: number | null;
  annual_change_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
};

type Account = {
  id: number;
  brokerage?: string;
  account_name?: string;
};

type AssetSortableKey =
  | 'name'
  | 'category'
  | 'value'
  | 'annual_change_type'
  | 'annual_increase_percent'
  | 'start_date'
  | 'end_date'
  | 'account';

type SortConfig = {
  key: AssetSortableKey | null;
  direction: 'asc' | 'desc';
};

type ConfirmDialogState = {
  isOpen: boolean;
  message: string;
  onConfirm: (() => Promise<void>) | null;
  title: string;
  confirmText: string;
  showCancel: boolean;
};

interface AssetViewProps {
  assets: Asset[];
  refreshAssets: () => Promise<void>;
  refreshCashflow?: () => Promise<void>;
  accounts?: Account[];
  validCategories?: string[];
}

export default function AssetView({
  assets,
  refreshAssets,
  refreshCashflow,
  accounts = [],
  validCategories = [],
}: AssetViewProps) {
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
    onConfirm: null,
    title: '',
    confirmText: 'Confirm',
    showCancel: true
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const tableRef = useRef<HTMLTableElement | null>(null);


  const formatCurrency = (v: number | null | undefined) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const remove = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Asset',
      message: 'Delete this asset?',
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: async () => {
        await AssetService.delete(id);
        await refreshAssets();
      },
    });
  };

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setShowAssetModal(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowAssetModal(true);
  };

  const handleCloseModal = () => {
    setShowAssetModal(false);
    setSelectedAsset(null);
  };

  const handleSaveSuccess = async () => {
    await refreshAssets();
    if (refreshCashflow) {
      await refreshCashflow();
    }
    handleCloseModal();
  };

  const handleSort = (key: AssetSortableKey) => {
    const nextDirection: SortConfig['direction'] =
      sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: nextDirection });
  };

  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    if (accounts && accounts.length > 0) {
      accounts.forEach((acc: any) => {
        const brokerage = acc.brokerage || '';
        const accountName = acc.account_name || '';
        map.set(acc.id, `${brokerage} - ${accountName}`);
      });
    }
    return map;
  }, [accounts]);

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a: any, b: any) => {
      if (!sortConfig.key) return 0;

      let aValue: string | number = '';
      let bValue: string | number = '';

      if (sortConfig.key !== 'account') {
        const assetKey = sortConfig.key as keyof Asset;
        aValue = (a[assetKey] as string | number) ?? '';
        bValue = (b[assetKey] as string | number) ?? '';
      }

      if (sortConfig.key === 'account') {
        const aAccountLabel =
          typeof a.account_id === 'number' ? accountMap.get(a.account_id) : undefined;
        const bAccountLabel =
          typeof b.account_id === 'number' ? accountMap.get(b.account_id) : undefined;
        aValue = aAccountLabel ?? '-';
        bValue = bAccountLabel ?? '-';
      }

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (sortConfig.key === 'value' || sortConfig.key === 'annual_increase_percent') {
        aValue = parseFloat(String(aValue)) || 0;
        bValue = parseFloat(String(bValue)) || 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, sortConfig, accountMap]);

  const total = assets.reduce((sum: any, item: any) => sum + (item.value ?? 0), 0);

  const handleDownloadTablePdf = async (filename: string) => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    }
  };

  const convertToCsv = (
    dataArray: Record<string, unknown>[],
    headers: string[],
    valueFormatter: (value: number) => string,
  ) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach((row: any) => {
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

  const handleDownloadAssetsCsv = (filename: string) => {
    if (assets.length > 0) {
      const headers = ['Name', 'Category', 'Account', 'Value', 'Percent', 'Annual Change', 'Start Date', 'End Date'];
      const formattedData = assets.map((asset: any) => ({
        Name: asset.name,
        Category: asset.category,
        Account: asset.account_id ? (accountMap.get(asset.account_id) || '-') : '-',
        Value: asset.value,
        'Percent': asset.annual_increase_percent,
        'Annual Change': asset.annual_change_type,
        'Start Date': asset.start_date,
        'End Date': asset.end_date,
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    }
  };

  return (
    <div className="cashflow-container">
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Assets</h2>

      <button onClick={handleAddAsset} className="add-new-item-btn">
        Add New Asset
      </button>

    <div className="table-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
        <button className="btn-primary-modern" onClick={() => handleDownloadTablePdf("Assets_Table")}>Download PDF</button>
        <button className="btn-primary-modern" onClick={() => handleDownloadAssetsCsv("Assets_Table")}>Download CSV</button>
      </div>
      <div className="table-scroll">
        <table ref={tableRef} className="cashflow-table" style={{ width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="cashflow-table-cell sortable" style={{ width: '18%' }} onClick={() => handleSort('name')}>
                Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '10%' }} onClick={() => handleSort('category')}>
                Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '18%' }} onClick={() => handleSort('account')}>
                Account {sortConfig.key === 'account' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '12%' }} onClick={() => handleSort('value')}>
                Value {sortConfig.key === 'value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('annual_change_type')}>
                Annual Chg {sortConfig.key === 'annual_change_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cashflow-table-cell sortable" style={{ width: '7%' }} onClick={() => handleSort('annual_increase_percent')}>
              Percent {sortConfig.key === 'annual_increase_percent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('start_date')}>
              Start Date {sortConfig.key === 'start_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell sortable" style={{ width: '9%' }} onClick={() => handleSort('end_date')}>
              End Date {sortConfig.key === 'end_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th className="cashflow-table-cell" style={{ width: '8%' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAssets.map((item: any) => {
            const categoryValue = item.category && typeof item.category === 'string' ? item.category.trim() : (item.category || '');
            const categoryMissing = !categoryValue || (validCategories.length > 0 && !validCategories.includes(categoryValue));
            const nameMissing = !item.name;
            const valueMissing = (item.value === null || item.value === undefined);
            const hasMissingFields = nameMissing || categoryMissing || valueMissing;
            
            let rowStyle = {};
            if (hasMissingFields) {
              rowStyle = { backgroundColor: '#fff3cd', borderLeft: '4px solid #ffc107' };
            }
            
            const missingFields = [nameMissing && 'Name', !categoryValue && 'Category', categoryMissing && categoryValue && 'Invalid Category', valueMissing && 'Value'].filter(Boolean);
            
            return (
            <tr key={item.id} style={rowStyle} title={hasMissingFields ? 'Missing required fields: ' + missingFields.join(', ') : ''}>
              <td className="cashflow-table-cell">{item.name || <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Name</span>}</td>
              <td className="cashflow-table-cell">
                {categoryValue ? (
                  categoryMissing ? (
                    <span style={{ color: '#0066cc', fontStyle: 'italic', fontWeight: 'bold' }}>{item.category} (Invalid)</span>
                  ) : (
                    item.category
                  )
                ) : (
                  <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Missing: Category</span>
                )}
              </td>
              <td className="cashflow-table-cell">{item.account_id ? (accountMap.get(item.account_id) || '-') : '-'}</td>
              <td className="cashflow-table-cell">{formatCurrency(item.value)}</td>
              <td className="cashflow-table-cell">{item.annual_change_type}</td>
              <td className="cashflow-table-cell">{item.annual_increase_percent}%</td>
              <td className="cashflow-table-cell">{item.start_date}</td>
              <td className="cashflow-table-cell">{item.end_date}</td>
              <td className="action-buttons-cell">
                <button onClick={() => handleEditAsset(item)} className="edit-icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                <button onClick={() => remove(item.id)} className="delete-icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="total">
        <strong>Total Assets: {formatCurrency(total)}</strong>
      </div>

        <AssetFormModal
        isOpen={showAssetModal}
        onClose={handleCloseModal}
        item={selectedAsset}
        onSaveSuccess={handleSaveSuccess}
      />

        <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false, onConfirm: null })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        showCancel={confirmDialog.showCancel}
      />
    </div>
  );
}
