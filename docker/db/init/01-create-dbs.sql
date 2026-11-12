-- Инициализация локального Postgres для PICboard (см. docker-compose.db.yml).
-- users_db создаётся самим образом через POSTGRES_DB, здесь — остальные сервисы.
-- Выполняется только при первом создании тома pgdata.

CREATE DATABASE posts_db;
CREATE DATABASE files_db;
