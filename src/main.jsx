import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { installDevtoolsDeterrence } from './utils/devtoolsDeterrence';
import { startKeepAlive } from './utils/keepAlive';

/**
 * Blocks the right-click menu and the devtools shortcuts in production builds.
 *
 * Deterrence only — devtools cannot actually be disabled from a page, and
 * everything this application sends the browser stays readable to anyone who
 * looks. See the module for the full caveat. Nothing is protected BY this.
 */
installDevtoolsDeterrence();

/**
 * Pings the API every few minutes so a host that sleeps an idle service does
 * not cold-start under someone who is mid-session.
 *
 * Off unless the build sets VITE_KEEPALIVE — staging does, production and
 * local development do not. The ping goes to /health, which is answered before
 * the auth gate and touches no database. See the module.
 */
startKeepAlive();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
