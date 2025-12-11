import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import CustomChartService from '../services/customChart.service';
import './CustomChartView.css'; // We will create this CSS file

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function CustomChartView({ chartId, assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, onBack }) {
  const { currentUser } = useAuth();
  const [chartConfig, setChartConfig] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const chartRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const [showChartTotals, setShowChartTotals] = useState(true); // State for individual chart totals

  const prepareChartData = useCallback((fetchedConfig) => {
    const labels = Array.from({ length: projectionYears + 1 }, (_, i) => currentYear + i);
    let datasets = []; // Changed to let to allow modification

    let allData = {
      assets: assets || [],
      liabilities: liabilities || [],
      income: incomeItems || [],
      expenses: expenseItems || [],
    };

    try {
      const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations);

      seriesConfigurations.forEach((series, index) => {
        const sourceData = allData[series.data_type];
        if (!sourceData) {
          console.warn(`Data source ${series.data_type} not found.`);
          return;
        }

        const dataValues = labels.map((year, yearIndex) => {
          let aggregatedValue = 0;
          sourceData.forEach(item => {
            // Apply category filter if specified
            if (series.category && item.category !== series.category) {
              return;
            }

            const itemStartDate = item.start_date ? new Date(item.start_date) : null;
            const itemEndDate = item.end_date ? new Date(item.end_date) : null;

            const isActive = 
              (!itemStartDate || year >= itemStartDate.getFullYear()) &&
              (!itemEndDate || year <= itemEndDate.getFullYear());

            if (isActive) {
              // Handle different data types and fields
              let value = item[series.field];
              if (series.data_type === 'income' || series.data_type === 'expenses') {
                // For cashflow items, yearly_value might be the base, then adjust for increase/inflation
                const annualRate = (series.data_type === 'income' ? item.annual_increase_percent : item.inflation_percent) / 100;
                value = item.yearly_value * Math.pow(1 + annualRate, yearIndex); 
              } else if (series.data_type === 'assets' || series.data_type === 'liabilities') {
                 const growthRate = item.annual_increase_percent / 100;
                 value = item.value * Math.pow(1 + growthRate, yearIndex);
              }

              aggregatedValue += value || 0;
            }
          });
          return aggregatedValue;
        });

        datasets.push({
          label: series.label,
          data: dataValues,
          borderColor: series.color,
          backgroundColor: series.color + "40", // Add some transparency
          fill: false,
          tension: 0.1,
          // Specifics for chart types
          ...(fetchedConfig.chart_type === 'bar' && { backgroundColor: series.color }),
          ...(fetchedConfig.chart_type === 'pie' && { backgroundColor: series.color, borderColor: '#fff', borderWidth: 1 }),
        });
      });

      // Calculate and add Total line if showChartTotals is true
      if (showChartTotals && (fetchedConfig.chart_type === 'line' || fetchedConfig.chart_type === 'bar')) {
        const totalDataValues = labels.map((_, yearIndex) => {
          let sum = 0;
          datasets.forEach(dataset => {
            sum += dataset.data[yearIndex] || 0;
          });
          return sum;
        });

        datasets.push({
          label: 'Total',
          data: totalDataValues,
          borderColor: '#000000', // Black color for total line
          backgroundColor: '#000000', // Black color for total line
          fill: false,
          tension: 0.1,
          borderWidth: 3, // Thicker line for total
          pointRadius: 4,
          pointBackgroundColor: '#000000',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#000000',
          pointHoverBorderColor: '#ffffff',
          borderDash: [5, 5], // Dashed line for total
        });
      }

    } catch (e) {
      console.error("Error parsing series configurations or preparing data:", e);
      setMessage("Error preparing chart data.");
      datasets = []; // Ensure datasets is empty on error
      return;
    }

    setChartData({ labels, datasets });
  }, [assets, liabilities, incomeItems, expenseItems, projectionYears, currentYear, showChartTotals]); // Added showChartTotals dependency

  useEffect(() => {
    const fetchAndPrepareChart = async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await CustomChartService.get(chartId);
        const fetchedConfig = response.data;
        setChartConfig(fetchedConfig);
        prepareChartData(fetchedConfig); // Call the memoized function
      } catch (error) {
        console.error("Error fetching custom chart:", error);
        setMessage("Failed to load chart configuration.");
      } finally {
        setLoading(false);
      }
    };

    if (chartId) {
      fetchAndPrepareChart();
    }
  }, [chartId, prepareChartData]); // prepareChartData is a dependency

  const getChartComponent = () => {
    if (!chartConfig || chartData.datasets.length === 0) return null;

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `Financial Project - ${chartConfig.name}${currentUser ? ` by ${currentUser.username}` : ''}`,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatCurrency(context.parsed.y);
              } else if (context.parsed !== null) { // For pie charts, context.parsed is a single value
                label += formatCurrency(context.parsed);
              }
              return label;
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: !!chartConfig.x_axis_label,
            text: chartConfig.x_axis_label,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: !!chartConfig.y_axis_label,
            text: chartConfig.y_axis_label,
          },
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        },
      },
      ...(chartConfig.chart_type === 'pie' && {
        scales: { // No scales for pie chart
          x: { display: false },
          y: { display: false },
        },
        plugins: { // Re-configure plugins for pie charts specifically
          legend: { position: 'top' },
          title: { display: true, text: `Financial Project - ${chartConfig.name}${currentUser ? ` by ${currentUser.username}` : ''}` },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed !== null) {
                  label += formatCurrency(context.parsed);
                }
                return label;
              }
            }
          },
        }
      })
    };

    switch (chartConfig.chart_type) {
      case 'line':
        return <Line ref={chartRef} data={chartData} options={options} />;
      case 'bar':
        return <Bar ref={chartRef} data={chartData} options={options} />;
      case 'pie':
        // For pie charts, we don't have a "sum of lines" concept, as it's a single point in time aggregate.
        // The `showChartTotals` will not apply to pie charts in this context.
        const pieLabels = chartData.datasets.map(ds => ds.label);
        const pieDataValues = chartData.datasets.map(ds => ds.data.reduce((sum, val) => sum + val, 0)); // Sum all values for pie
        const pieBackgroundColors = chartData.datasets.map(ds => ds.backgroundColor);
        const pieBorderColors = chartData.datasets.map(ds => ds.borderColor);

        return <Pie 
          ref={chartRef}
          data={{
            labels: pieLabels,
            datasets: [{
              data: pieDataValues,
              backgroundColor: pieBackgroundColors,
              borderColor: pieBorderColors,
              borderWidth: 1,
            }],
          }}
          options={options} // Use the consolidated options object
        />;
      default:
        return <p>Unsupported chart type: {chartConfig.chart_type}</p>;
    }
  };

  const handleDownloadPng = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${chartConfig.name.replace(/\s/g, '_') || 'chart'}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
      setMessage("Error: Chart not ready for download.");
    }
  };

  const handleDownloadPdf = () => {
    if (chartRef.current) {
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(chartImage);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(chartImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${chartConfig.name.replace(/\s/g, '_') || 'chart'}.pdf`);
    } else {
      console.error("Chart ref is not available for PDF download.");
      setMessage("Error: Chart not ready for download.");
    }
  };

  if (loading) {
    return <div className="loading">Loading chart...</div>;
  }

  if (message) {
    return <div className="message error">{message}</div>;
  }

  return (
    <div className="custom-chart-view-container">
      <button onClick={onBack} className="back-btn">← Back to Custom Charts</button>
      <div className="chart-actions">
        <button onClick={handleDownloadPng} className="download-btn">Download PNG</button>
        <button onClick={handleDownloadPdf} className="download-btn">Download PDF</button>
        <label className="show-totals-toggle">
          <input
            type="checkbox"
            checked={showChartTotals}
            onChange={(e) => setShowChartTotals(e.target.checked)}
          />
          Show Chart Totals
        </label>
      </div>
      <div className="chart-display-area">
        {getChartComponent()}
      </div>
    </div>
  );
}
