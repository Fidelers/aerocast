export const POLLUTANTS_METADATA = {};


export function normalizePollutantKey(key) {
    // реализовать нормализацию ключей
    return null;
}


export function getPollutantMetadata(key) {
    // реализовать получение метаданных
    return null;
}

export function getPollutantAssessment(key, value) {
    // реализовать расчет статуса по пороговым значениям EAQI
    return {
        label: 'нет данных',
        color: '#9E9E9E',
        level: 'unknown'
    };
}
