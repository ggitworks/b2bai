import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useStore } from './store';

// Initialize Gemini APIs with the provided keys
useStore.getState().setGeminiApiKey('AIzaSyBAYNZ3ty4PU3bRFsg5twQpGEaYypcxWFU');
useStore.getState().setTranslationApiKey('AIzaSyAYzXAKPF2uEZ3QiRpwpAFRhRVQF7AkkyM');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
