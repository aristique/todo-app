CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    completed   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO tasks (title, description, completed) VALUES
  ('Изучить Docker', 'Освоить работу с контейнерами и сетями', false),
  ('Написать REST API', 'Node.js + Express + PostgreSQL', false),
  ('Сделать фронтенд', 'HTML/CSS/JS для ToDo приложения', false);