import { useState } from 'react'
import React from 'react'
import './App.css'
import Test from './components/Test';

function App() {
    return (
        <div>
            <h1>Тест</h1>
            <Test />
        </div>
    );
}
export default App;

// //============ Тест на работоспособность компонента карты
// import MapComponent from './components/MapComponent';
// import './App.css';
//
// export default function App() {
//     return (
//         // Задаем жесткие размеры на весь экран, чтобы карте было где развернуться
//         <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
//             <MapComponent />
//         </div>
//     );
// }