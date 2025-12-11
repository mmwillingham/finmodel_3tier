import React, { useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";

export default function CashFlowOverview({ incomeItems, expenseItems, projectionYears, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const tableRef = useRef(null);

  const calculateCashFlowProjection = () => {
    const years = [];
    const incomeValues = [];
    const expenseValues = [];
    const surplus = [];

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalIncome = 0;
      incomeItems.forEach((item) => {
        const growthRate = item.annual_increase_percent / 100;
        totalIncome += item.yearly_value * Math.pow(1 + growthRate, year);
      });

      let totalExpenses = 0;
      expenseItems.forEach((item) => {
        const inflationRate = item.inflation_percent / 100;
        totalExpenses += item.yearly_value * Math.pow(1 + inflationRate, year);
      });

      incomeValues.push(totalIncome);
      expenseValues.push(totalExpenses);
      surplus.push(totalIncome - totalExpenses);
    }

    return { years, incomeValues, expenseValues, surplus };
  };

  const cashFlowProjection = calculateCashFlowProjection();

  const cashFlowChartData = {
    labels: cashFlowProjection.years.map(year => currentYear + year), // Adjust labels to current year
    datasets: [
      {
        label: "Income",
        data: cashFlowProjection.incomeValues,
        borderColor: "rgb(75, 192, 75)",
        backgroundColor: "rgba(75, 192, 75, 0.2)",
      },
      {
        label: "Expenses",
        data: cashFlowProjection.expenseValues,
        borderColor: "rgb(255, 99, 99)",
        backgroundColor: "rgba(255, 99, 99, 0.2)",
      },
      {
        label: "Surplus",
        data: cashFlowProjection.surplus,
        borderColor: "rgb(153, 102, 255)",
        backgroundColor: "rgba(153, 102, 255, 0.2)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Show every 5th year in tables
  const displayYears = cashFlowProjection.years.filter((y) => y % 5 === 0);

  // Download functions (reusing from ProjectionDetail.js pattern)
  const handleDownloadChartPng = (chartRef, filename) => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${filename.replace(/\s/g, '_')}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
    }
  };

  const handleDownloadChartPdf = (chartRef, filename) => {
    if (chartRef.current) {
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(chartImage);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(chartImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
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

  const handleDownloadCashFlowCsv = (filename) => {
    if (cashFlowProjection.years.length > 0) {
      const headers = ['Year', 'Income', 'Expenses', 'Surplus'];
      const formattedData = cashFlowProjection.years.map(year => ({
        Year: currentYear + year,
        Income: cashFlowProjection.incomeValues[year],
        Expenses: cashFlowProjection.expenseValues[year],
        Surplus: cashFlowProjection.surplus[year],
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Cash Flow CSV download.");
    }
  };

  return (
    <div className="cashflow-overview-container">
      <h3>Income & Expense Projection</h3>
      <div style={{ marginBottom: "30px" }}>
        <div className="chart-actions">
          <button onClick={() => handleDownloadChartPng(chartRef, "Income_Expense_Projection")}>Download PNG</button>
          <button onClick={() => handleDownloadChartPdf(chartRef, "Income_Expense_Projection")}>Download PDF</button>
        </div>
        <Line ref={chartRef} data={cashFlowChartData} options={chartOptions} />
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Cash_Flow_Overview_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadCashFlowCsv("Cash_Flow_Overview_Table")}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Surplus</th>
          </tr>
        </thead>
        <tbody>
          {displayYears.map((year) => (
            <tr key={year}>
              <td>{currentYear + year}</td> {/* Adjust table year to current year */}
              <td>{formatCurrency(cashFlowProjection.incomeValues[year])}</td>
              <td>{formatCurrency(cashFlowProjection.expenseValues[year])}</td>
              <td>{formatCurrency(cashFlowProjection.surplus[year])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
