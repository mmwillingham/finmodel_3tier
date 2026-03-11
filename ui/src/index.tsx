import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const isProd =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) ||
  process.env.NODE_ENV === 'production';

if (isProd) {
  const noop = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = noop;
  console.debug = noop;
  console.warn = noop;
  console.error = noop;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
