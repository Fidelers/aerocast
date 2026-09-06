import { useState, useEffect } from 'react';

export default function Test() {
    const [message, setMessage] = useState('Ожидание ответа от сервера...');

    useEffect(() => {
        fetch('http://localhost:3000/ping')
            .then((response) => response.json())
            .then((data) => {
                setMessage(data.message);
            })
            .catch((error) => {
                setMessage('Ошибка подключения: ' + error.message);
            });
    }, []);

    return (
        <div style={{ padding: '20px', border: '2px dashed #4CAF50', borderRadius: '8px', margin: '20px 0' }}>
            <h3>Тест связи:</h3>
            <p>Ответ от бэкенда: <strong>{message}</strong></p>
        </div>
    );
}