import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { installDevtoolsDeterrence } from './utils/devtoolsDeterrence';

/**
 * Blocks the right-click menu and the devtools shortcuts in production builds.
 *
 * Deterrence only — devtools cannot actually be disabled from a page, and
 * everything this application sends the browser stays readable to anyone who
 * looks. See the module for the full caveat. Nothing is protected BY this.
 */
installDevtoolsDeterrence();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
