type ReportHandler = (metric: { name: string }) => void;

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (typeof onPerfEntry !== 'function') {
    return;
  }

  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    onCLS(onPerfEntry);
    onFID(onPerfEntry);
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
  });
};

export default reportWebVitals;
