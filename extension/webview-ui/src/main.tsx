import React from 'react';
import ReactDOM from 'react-dom/client';
import type { ReactNode } from 'react';
import App from './App';
import './index.css';

const vscode = acquireVsCodeApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App vscode={vscode} />
  </React.StrictMode>
);

// Notify extension that webview is ready
vscode.postMessage({ type: 'ready' });
