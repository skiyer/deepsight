import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

const vscode = acquireVsCodeApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App vscode={vscode} />
  </React.StrictMode>
);

// Notify extension that webview is ready
vscode.postMessage({ type: 'ready' });
