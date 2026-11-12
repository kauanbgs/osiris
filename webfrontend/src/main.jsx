import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { applyTheme } from './lib/theme';
import { isElectron } from './utils/isElectron';

applyTheme();

// Em desktop (Electron ou arquivo local file://), o HashRouter é essencial
// para que o roteamento funcione de forma independente sem depender de servidor web ou sofrer com caminhos de drive (C:/).
// Na Vercel (web), usamos BrowserRouter com URLs limpas.
const isDesktop = isElectron() || (typeof window !== 'undefined' && window.location.protocol === 'file:');
const Router = isDesktop ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>
);
