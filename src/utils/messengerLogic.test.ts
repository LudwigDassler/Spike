import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMessageText,
  resolveMessageAddressing,
  canUserSeeWorkspaceMessage,
  isDirectMessageBetweenUsers,
  filterMessagesForActiveThread,
} from './messengerLogic';

test('extractMessageText normalizes message_text, text, content, and message fields', () => {
  assert.equal(extractMessageText({ message_text: '  Привет, Иван!  ' }), 'Привет, Иван!');
  assert.equal(extractMessageText({ text: 'Срочное поручение' }), 'Срочное поручение');
  assert.equal(extractMessageText({ content: 'Контент сообщения' }), 'Контент сообщения');
  assert.equal(extractMessageText({ message: 'Текст из бота' }), 'Текст из бота');
  assert.equal(extractMessageText({}), '');
});

test('resolveMessageAddressing sets target_type direct with target_id and target_label', () => {
  const nodes = [
    { id: 'uuid-frolov', name: 'Фролов Иван Петрович', role_type: 'Инженер' },
    { id: 'uuid-lytnev', name: 'Лытнев Артем Олегович', role_type: 'Экономист' },
  ];

  const direct = resolveMessageAddressing(
    {
      target_type: 'direct',
      target_id: 'uuid-frolov',
    },
    nodes
  );
  assert.equal(direct.target_type, 'direct');
  assert.equal(direct.target_id, 'uuid-frolov');
  assert.equal(direct.target_label, 'Фролов Иван Петрович');
});

test('canUserSeeWorkspaceMessage enforces strict privacy for direct messages (even against root/other employees)', () => {
  const sender = {
    id: 'uuid-admin',
    name: 'Page',
    role_type: 'SUPERADMIN',
    access_level: 'root' as const,
  };
  const recipient = {
    id: 'uuid-frolov',
    name: 'Фролов Иван Петрович',
    role_type: 'Инженер',
    access_level: 'member' as const,
  };
  const bystander = {
    id: 'uuid-lytnev',
    name: 'Лытнев Артем Олегович',
    role_type: 'Экономист',
    access_level: 'member' as const,
  };
  const anotherRoot = {
    id: 'uuid-root-2',
    name: 'Второй Директор',
    role_type: 'SUPERADMIN',
    access_level: 'root' as const,
  };

  const directMsg = {
    id: 'msg-1',
    company_id: 'comp-1',
    sender_id: 'uuid-admin',
    sender_name: 'Page',
    target_type: 'direct' as const,
    target_id: 'uuid-frolov',
    target_label: 'Фролов Иван Петрович',
    message_text: 'Личное сообщение только для Ивана',
    text: 'Личное сообщение только для Ивана',
    content: 'Личное сообщение только для Ивана',
  };

  assert.equal(canUserSeeWorkspaceMessage(directMsg, sender), true);
  assert.equal(canUserSeeWorkspaceMessage(directMsg, recipient), true);
  assert.equal(canUserSeeWorkspaceMessage(directMsg, bystander), false);
  assert.equal(canUserSeeWorkspaceMessage(directMsg, anotherRoot), false);
});

test('canUserSeeWorkspaceMessage enforces department isolation and allows root', () => {
  const financeMember = {
    id: 'uuid-lytnev',
    name: 'Лытнев Артем Олегович',
    department: 'Финансовый отдел',
    access_level: 'member' as const,
  };
  const salesMember = {
    id: 'uuid-sales',
    name: 'Менеджер Продаж',
    department: 'Отдел продаж',
    access_level: 'member' as const,
  };
  const rootUser = {
    id: 'uuid-root',
    name: 'Генеральный директор',
    department: 'Дирекция',
    access_level: 'root' as const,
  };

  const deptMsg = {
    id: 'msg-dept-1',
    company_id: 'comp-1',
    sender_id: 'uuid-root',
    target_type: 'department' as const,
    target_id: 'Финансовый отдел',
    target_label: 'Финансовый отдел',
    message_text: 'Закрыть квартальный баланс',
    text: 'Закрыть квартальный баланс',
    content: 'Закрыть квартальный баланс',
  };

  assert.equal(canUserSeeWorkspaceMessage(deptMsg, financeMember), true);
  assert.equal(canUserSeeWorkspaceMessage(deptMsg, salesMember), false);
  assert.equal(canUserSeeWorkspaceMessage(deptMsg, rootUser), true);
});

test('filterMessagesForActiveThread isolates 1-on-1 dialogs and channels accurately', () => {
  const me = { id: 'u-1', name: 'Page', access_level: 'root' as const, department: 'Дирекция' };
  const frolov = { id: 'u-2', name: 'Фролов Иван Петрович', role_type: 'Инженер' };
  const lytnev = { id: 'u-3', name: 'Лытнев Артем Олегович', role_type: 'Экономист' };

  const messages = [
    {
      id: 'm1',
      sender_id: 'u-1',
      target_type: 'direct',
      target_id: 'u-2',
      target_label: 'Фролов Иван Петрович',
      message_text: 'Привет, Иван!',
      created_at: '2026-10-26T08:00:00Z',
    },
    {
      id: 'm2',
      sender_id: 'u-2',
      target_type: 'direct',
      target_id: 'u-1',
      target_label: 'Page',
      message_text: 'Добрый день, принял в работу!',
      created_at: '2026-10-26T08:01:00Z',
    },
    {
      id: 'm3',
      sender_id: 'u-1',
      target_type: 'direct',
      target_id: 'u-3',
      target_label: 'Лытнев Артем Олегович',
      message_text: 'Артем, пришли отчет',
      created_at: '2026-10-26T08:02:00Z',
    },
    {
      id: 'm4',
      sender_id: 'u-1',
      target_type: 'broadcast',
      target_label: 'Всем сотрудникам',
      message_text: 'Общее собрание в 15:00',
      created_at: '2026-10-26T08:03:00Z',
    },
  ];

  const frolovDialog = filterMessagesForActiveThread(
    messages,
    {
      type: 'direct',
      id: frolov.id,
      label: frolov.name,
      targetType: 'direct',
      targetId: frolov.id,
      targetLabel: frolov.name,
      colleague: frolov as any,
    },
    me
  );
  assert.equal(frolovDialog.length, 2);
  assert.deepEqual(
    frolovDialog.map((m) => m.id),
    ['m1', 'm2']
  );

  const broadcastChannel = filterMessagesForActiveThread(
    messages,
    {
      type: 'broadcast',
      id: 'broadcast',
      label: 'Общий поток (Циркуляры компании)',
      targetType: 'broadcast',
      targetId: 'broadcast',
      targetLabel: 'Общий поток (Циркуляры компании)',
    },
    me
  );
  assert.equal(broadcastChannel.length, 1);
  assert.equal(broadcastChannel[0].id, 'm4');
  assert.equal(isDirectMessageBetweenUsers(messages[0], me, lytnev), false);
});

test('formatCompactIncomingTelegramMessage formats strictly 2 lines without bureaucratic headers and extractColleagueNameFromReplyText parses swipe-reply', async () => {
  const { formatCompactIncomingTelegramMessage, extractColleagueNameFromReplyText } = await import(
    '../../api/telegram/webhook'
  );

  const dmText = formatCompactIncomingTelegramMessage({
    senderName: 'Шмаков Н.В.',
    senderRole: 'Генеральный директор',
    targetType: 'direct',
    messageText: 'Пошли обедать в 13:00',
  });
  const lines = dmText.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '<b>Шмаков Н.В.</b> · <i>Генеральный директор</i>');
  assert.equal(lines[1], 'Пошли обедать в 13:00');
  assert.equal(dmText.includes('ВХОДЯЩЕЕ СООБЩЕНИЕ'), false);

  const plainQuoted = 'Шмаков Н.В. · Генеральный директор\nПошли обедать в 13:00';
  assert.equal(extractColleagueNameFromReplyText(plainQuoted), 'Шмаков Н.В.');
});

