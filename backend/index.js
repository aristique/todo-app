const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();

// Создаём HTTP-сервер вручную (нужно для socket.io)
const httpServer = createServer(app);

// Инициализируем socket.io поверх HTTP-сервера
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// Подключение к PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'todouser',
  password: process.env.DB_PASSWORD || 'todopassword',
  database: process.env.DB_NAME || 'tododb',
});

// ─── Обработка WebSocket подключений ───────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ─── REST API ───────────────────────────────────────────────────────────────

// GET /tasks — получить все задачи
app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /tasks/:id — получить задачу по ID
app.get('/tasks/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /tasks — создать задачу
app.post('/tasks', async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, completed)
       VALUES ($1, $2, false)
       RETURNING *`,
      [title, description || '']
    );
    const newTask = result.rows[0];

    // Уведомляем ВСЕХ клиентов о новой задаче
    io.emit('task:created', newTask);

    res.status(201).json(newTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /tasks/:id — обновить задачу
app.put('/tasks/:id', async (req, res) => {
  const { title, description, completed } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tasks
       SET title = $1, description = $2, completed = $3
       WHERE id = $4
       RETURNING *`,
      [title, description, completed, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const updatedTask = result.rows[0];

    // Уведомляем ВСЕХ клиентов об обновлении
    io.emit('task:updated', updatedTask);

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /tasks/:id — удалить задачу
app.delete('/tasks/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const deletedId = result.rows[0].id;

    // Уведомляем ВСЕХ клиентов об удалении
    io.emit('task:deleted', { id: deletedId });

    res.json({ message: 'Task deleted', id: deletedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Запуск ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

// ВАЖНО: запускаем httpServer, а не app.listen(!)
httpServer.listen(PORT, () => {
  console.log(`Backend + WebSocket server running on port ${PORT}`);
});
