import { useState } from 'react';
import React from 'react';
import './App.css';
import Test from './components/Test';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';

function App() {
    return (
        <div className='layout'>
            <Sidebar />
            <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
                <MapComponent />
            </div>
        </div>
    );
}

export default App;