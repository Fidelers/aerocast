import React from 'react';
import '../styles/LayerSwitcher.css';


export default function LayerSwitcher({ activeLayer = 'osm', onLayerChange }) {
    // 1. Отображение кнопки текущего слоя ("Карта" / "Спутник")
    // 2. Раскрытие/закрытие выпадающего меню по клику на кнопку
    // 3. Вызов onLayerChange при выборе неактивного слоя
    // 4. Закрытие меню по клику вне компонента (click-outside) и по клавише Escape
    return null;
}
