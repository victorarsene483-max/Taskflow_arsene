CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(255) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
