import { createApp } from './app.mjs';
import { pool } from '../db/queries.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не задан. Укажи его в локальном файле .env.');
  process.exit(1);
}

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT должен быть целым числом от 1 до 65535.');
  process.exit(1);
}

const app = createApp();
const server = app.listen(port, () => {
  console.log(`Personal Data Safety API запущен на порту ${port}.`);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Получен ${signal}; завершение работы сервера.`);

  server.close(async (serverError) => {
    if (serverError) console.error('Ошибка остановки HTTP-сервера:', serverError.message);

    try {
      await pool.end();
    } catch (databaseError) {
      console.error('Ошибка закрытия пула PostgreSQL:', databaseError.message);
    }

    process.exitCode = serverError ? 1 : 0;
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
