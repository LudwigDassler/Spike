#!/usr/bin/env node

/**
 * Скрипт однократной инициализации нативного меню команд Telegram-бота TedCloud.
 * Запуск локально:
 *   TELEGRAM_BOT_TOKEN="123456:ABC-DEF" node scripts/set-bot-menu.js
 */

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error(
    '❌ Ошибка: Переменная окружения TELEGRAM_BOT_TOKEN не задана.\nПример запуска: TELEGRAM_BOT_TOKEN="ваш_токен" node scripts/set-bot-menu.js'
  );
  process.exit(1);
}

const TEDCLOUD_COMMANDS = [
  { command: 'start', description: 'Открыть TedCloud' },
  { command: 'help', description: 'Справка' },
  { command: 'new', description: 'Быстрая задача' },
];

async function setTelegramBotMenu() {
  const endpoint = `https://api.telegram.org/bot${botToken}/setMyCommands`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: TEDCLOUD_COMMANDS,
        language_code: 'ru',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || `HTTP ${response.status}`);
    }

    console.log('✅ Команды меню бота TedCloud успешно установлены:');
    for (const cmd of TEDCLOUD_COMMANDS) {
      console.log(`   /${cmd.command} — ${cmd.description}`);
    }
  } catch (error) {
    console.error('❌ Не удалось установить меню команд бота:', error.message);
    process.exit(1);
  }
}

setTelegramBotMenu();
