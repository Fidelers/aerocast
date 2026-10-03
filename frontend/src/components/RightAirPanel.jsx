import React from 'react';
import '../styles/RightAirPanel.css';


export default function RightAirPanel({ airData, selectedTimeIndex = 0, isOpen = false, onClose }) {
    // 1. Возврат null, если !isOpen или !airData
    // 2. Шапка (координаты с 4 знаками, время, источник данных, кнопка закрытия)
    // 3. Общий показатель AQI с цветовым бейджем и рекомендацией
    // 4. Перенесенная шкала уровней AQI (подсветка активного диапазона)
    // 5. Список загрязнителей 1..n со статусами (PM2.5, PM10, NO2, SO2, O3, CO)
    // 6. Блок "Общ инф" выбранного загрязнителя (переключение по click / hover)
    // 7. Обработка клавиши Escape для закрытия панели
    return null;
}
