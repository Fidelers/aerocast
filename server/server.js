const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Твой измененный маршрут
app.get('/ping', (req, res) => {
    res.json({ message: 'Бэкенд на связи!' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});