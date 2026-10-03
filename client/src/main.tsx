import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

for (const key of ['theme', 'layout', 'input-tab']) {
  try {
    const previous = localStorage.getItem(`aidetector-${key}`);
    if (previous !== null && localStorage.getItem(`mefiance-${key}`) === null)
      localStorage.setItem(`mefiance-${key}`, previous);
  } catch {
    break;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
