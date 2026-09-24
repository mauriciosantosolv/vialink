import React from 'react';
import {createRoot} from 'react-dom/client';
import Fleet from './FleetApp';
import '../app/globals.css';
import './mobile.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fleet/></React.StrictMode>);
if('serviceWorker' in navigator&&import.meta.env.PROD){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}
