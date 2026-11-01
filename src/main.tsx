import { createRoot } from 'react-dom/client';
import App from './App';
import './renderer.css';
import './styles.css';
import './responsive.css';
import './project-notes.css';
import './readability.css';

createRoot(document.getElementById('root')!).render(<App />);
