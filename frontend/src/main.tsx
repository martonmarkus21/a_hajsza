import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </NotificationProvider>
  </React.StrictMode>,
);






