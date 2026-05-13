// ─── Конфигурация ────────────────────────────────────────────────────────────

const API = '/api';
let editingId = null;

// ─── WebSocket подключение ───────────────────────────────────────────────────

// socket.io автоматически подключается к текущему хосту
// Nginx проксирует /socket.io/ → backend
const socket = io();

const wsStatus = document.getElementById('ws-status');

socket.on('connect', () => {
  console.log('[WS] Connected, id:', socket.id);
  wsStatus.textContent = '🟢 Подключено (real-time)';
  wsStatus.className = 'ws-connected';
});

socket.on('disconnect', () => {
  console.log('[WS] Disconnected');
  wsStatus.textContent = '🔴 Отключено';
  wsStatus.className = 'ws-disconnected';
});

// Обработчики событий от сервера
// При получении события — обновляем таблицу без REST-запроса

socket.on('task:created', (task) => {
  console.log('[WS] task:created', task);
  addRowToTable(task);
});

socket.on('task:updated', (task) => {
  console.log('[WS] task:updated', task);
  updateRowInTable(task);
});

socket.on('task:deleted', ({ id }) => {
  console.log('[WS] task:deleted id=', id);
  removeRowFromTable(id);
});

// ─── REST функции ────────────────────────────────────────────────────────────

async function loadTasks() {
  try {
    const res = await fetch(`${API}/tasks`);
    const tasks = await res.json();
    const tbody = document.getElementById('tasks-body');
    tbody.innerHTML = '';
    tasks.forEach(task => addRowToTable(task));
  } catch (err) {
    console.error('Ошибка загрузки:', err);
  }
}

async function createTask() {
  const title = document.getElementById('input-title').value.trim();
  const description = document.getElementById('input-desc').value.trim();

  if (!title) {
    alert('Введите название задачи');
    return;
  }

  try {
    await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    // НЕ обновляем таблицу здесь!
    // Таблица обновится через WS событие 'task:created'
    document.getElementById('input-title').value = '';
    document.getElementById('input-desc').value = '';
  } catch (err) {
    console.error('Ошибка создания:', err);
  }
}

async function deleteTask(id) {
  if (!confirm('Удалить задачу?')) return;
  try {
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    // Строка удалится через WS событие 'task:deleted'
  } catch (err) {
    console.error('Ошибка удаления:', err);
  }
}

// ─── Редактирование ──────────────────────────────────────────────────────────

function openEdit(id) {
  editingId = id;
  const row = document.querySelector(`tr[data-id="${id}"]`);
  document.getElementById('edit-title').value = row.dataset.title;
  document.getElementById('edit-desc').value = row.dataset.desc;
  document.getElementById('edit-completed').checked = row.dataset.completed === 'true';
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  editingId = null;
}

async function saveEdit() {
  if (!editingId) return;
  const title = document.getElementById('edit-title').value.trim();
  const description = document.getElementById('edit-desc').value.trim();
  const completed = document.getElementById('edit-completed').checked;

  if (!title) {
    alert('Название не может быть пустым');
    return;
  }

  try {
    await fetch(`${API}/tasks/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, completed }),
    });
    // Строка обновится через WS событие 'task:updated'
    closeModal();
  } catch (err) {
    console.error('Ошибка обновления:', err);
  }
}

// ─── Работа с DOM (таблицей) ─────────────────────────────────────────────────

function addRowToTable(task) {
  // Если строка уже есть (например, при повторной загрузке) — пропускаем
  if (document.querySelector(`tr[data-id="${task.id}"]`)) return;

  const tbody = document.getElementById('tasks-body');
  const tr = document.createElement('tr');
  tr.dataset.id = task.id;
  tr.dataset.title = task.title;
  tr.dataset.desc = task.description || '';
  tr.dataset.completed = task.completed;

  tr.innerHTML = `
    <td>${task.id}</td>
    <td>${escapeHtml(task.title)}</td>
    <td>${escapeHtml(task.description || '')}</td>
    <td class="${task.completed ? 'done' : 'pending'}">
      ${task.completed ? '✅ Выполнено' : '⏳ В процессе'}
    </td>
    <td>
      <button onclick="openEdit(${task.id})">✏️</button>
      <button onclick="deleteTask(${task.id})">🗑️</button>
    </td>
  `;

  // Новые задачи вставляем в начало (как в loadTasks — ORDER BY created_at DESC)
  tbody.insertBefore(tr, tbody.firstChild);
}

function updateRowInTable(task) {
  const tr = document.querySelector(`tr[data-id="${task.id}"]`);
  if (!tr) return;

  tr.dataset.title = task.title;
  tr.dataset.desc = task.description || '';
  tr.dataset.completed = task.completed;

  tr.innerHTML = `
    <td>${task.id}</td>
    <td>${escapeHtml(task.title)}</td>
    <td>${escapeHtml(task.description || '')}</td>
    <td class="${task.completed ? 'done' : 'pending'}">
      ${task.completed ? '✅ Выполнено' : '⏳ В процессе'}
    </td>
    <td>
      <button onclick="openEdit(${task.id})">✏️</button>
      <button onclick="deleteTask(${task.id})">🗑️</button>
    </td>
  `;
}

function removeRowFromTable(id) {
  const tr = document.querySelector(`tr[data-id="${id}"]`);
  if (tr) tr.remove();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Инициализация ───────────────────────────────────────────────────────────

loadTasks();
