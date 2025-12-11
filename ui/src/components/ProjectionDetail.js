import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import ProjectionService from '../services/projection.service';
import './ProjectionDetail.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);


const ProjectionDetail = ({ projectionId, onEdit, onDelete }) => {
  const id = projectionId;

  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [accountDetails, setAccountDetails] = useState([]);
  const chartRef = useRef(null);
  const yearByYearTableRef = useRef(null);
  const accountDetailsTableRef = useRef(null);

  useEffect(() => {
    if (!id) {
      setError("No projection ID provided.");
      setLoading(false);
      return;
    }

    const fetchProjection = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const projData = await ProjectionService.getProjectionDetails(id); 
        setProjection(projData);

        if (projData?.data_json) {
          const parsed = JSON.parse(projData.data_json);
          setData(parsed);
          setAccountDetails(parsed);
        }
      } catch (err) {
        setError(err.message || "Failed to load projection.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjection();
  }, [id]);

  const getAccountNames = () => {
    if (!accountDetails || accountDetails.length === 0) return [];
    const keys = Object.keys(accountDetails[0]);
    return keys.filter(k => k !== 'Year' && k !== 'StartingValue' && k !== 'Total_Contribution' && k !== 'Total_Growth' && k !== 'Total_Value');
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const getCurrentYear = () => new Date().getFullYear();

  const handleDownloadChartPng = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${projection.name.replace(/\s/g, '_') || 'projection'}_chart.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
    }
  };

  const handleDownloadChartPdf = () => {
    if (chartRef.current) {
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(chartImage);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(chartImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${projection.name.replace(/\s/g, '_') || 'projection'}_chart.pdf`);
    } else {
      console.error("Chart ref is not available for PDF download.");
    }
  };

  const handleDownloadTablePdf = async (tableRef, filename) => {
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
      console.error("Table ref is not available for PDF download.");
    }
  };

  const convertToCsv = (dataArray, headers, valueFormatter) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`; // Format currency and escape quotes
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadYearByYearCsv = (filename) => {
    if (data.length > 0) {
      const headers = ['Year', 'StartingValue', 'Total_Contribution', 'Total_Growth', 'Total_Value'];
      const formattedData = data.map((item, idx) => ({
        Year: currentYear + idx,
        StartingValue: item.StartingValue,
        Total_Contribution: item.Total_Contribution,
        Total_Growth: item.Total_Growth,
        Total_Value: item.Total_Value,
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Year-by-Year CSV download.");
    }
  };

  const handleDownloadAccountDetailsCsv = (filename) => {
    if (accountDetails.length > 0 && accountNames.length > 0) {
      const headers = ['Year', ...accountNames, 'Total_Value'];
      const formattedData = accountDetails.map((item, idx) => {
        const row = { Year: currentYear + idx };
        accountNames.forEach(name => {
          row[name] = item[name];
        });
        row.Total_Value = item.Total_Value;
        return row;
      });
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Account Details CSV download.");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!projection) return <p>No projection found.</p>;

  const accountNames = getAccountNames();
  const currentYear = getCurrentYear();

  // Prepare chart data
  const chartLabels = data.map((_, idx) => currentYear + idx);
  const chartDatasets = accountNames.map((name, idx) => ({
    label: name,
    data: accountDetails.map(year => year[name]),
    borderColor: `hsl(${idx * 60}, 70%, 50%)`,
    backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`,
    tension: 0.4,
  }));

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `${projection.name} - Growth Over Time` },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value),
        },
      },
    },
  };

  return (
    <div className="projection-detail">
      <div className="projection-header">
        <div>
          <h2>{projection.name}</h2>
          <p>Years: {projection.years}</p>
        </div>
        <div className="projection-actions">
          {onEdit && <button onClick={() => onEdit(projection)} className="edit-btn">Edit</button>}
          {onDelete && <button onClick={() => onDelete(projection.id)} className="delete-btn">Delete</button>}
        </div>
      </div>

      <h3>Growth Chart</h3>
      <div className="chart-container">
        <Line data={{ labels: chartLabels, datasets: chartDatasets }} options={chartOptions} />
      </div>

      <h3>Year-by-Year Breakdown</h3>
      <table className="projection-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Starting Value</th>
            <th>Contributions</th>
            <th>Growth</th>
            <th>Final Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((year, idx) => (
            <tr key={idx}>
              <td>{currentYear + idx}</td>
              <td>{formatCurrency(year.StartingValue)}</td>
              <td>{formatCurrency(year.Total_Contribution)}</td>
              <td>{formatCurrency(year.Total_Growth)}</td>
              <td>{formatCurrency(year.Total_Value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Account Details</h3>
      <table className="projection-table">
        <thead>
          <tr>
            <th>Year</th>
            {accountNames.map(name => (
              <th key={name}>{name}</th>
            ))}
            <th>Final Value</th>
          </tr>
        </thead>
        <tbody>
          {accountDetails.map((year, idx) => (
            <tr key={idx}>
              <td>{currentYear + idx}</td>
              {accountNames.map(name => (
                <td key={name}>{formatCurrency(year[name])}</td>
              ))}
              <td>{formatCurrency(year.Total_Value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectionDetail;
>
      </table>
    </div>
  );
};

export default ProjectionDetail;
