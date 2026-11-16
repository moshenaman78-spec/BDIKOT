import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { cssVariables } from './styles/tokens';
import './styles/theme.css';
import './styles/print.css';

const style = document.createElement('style');
style.textContent = cssVariables();
document.head.prepend(style);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
