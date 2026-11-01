import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeOffline } from './offline';
import './renderer.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
void initializeOffline();
