import test from 'node:test';
import assert from 'node:assert/strict';

// Изолированное окружение: только in-memory хранилище, без Supabase и Telegram.
process.env.TEDCLOUD_SESSION_SECRET = 'test-secret-for-tedcloud-sessions-0123456789abcdef';
for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'TELEGRAM_BOT_TOKEN',
  'GEMINI_API_KEY',
]) {
  delete process.env[key];
}

const { signSessionToken, verifySessionToken, extractBearerToken } = await import(
  '../../api/_lib/sessionAuth'
);
const { default: handler, evaluateMutationAccess } = await import('../../api/db');

interface MockResponse {
  statusCode: number;
  body: any;
}

async function callApi(params: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: any;
  query?: Record<string, string>;
}): Promise<MockResponse> {
  const result: MockResponse = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(payload: any) {
      result.body = payload;
      return res;
    },
    setHeader() {},
  };
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (params.token) headers.authorization = `Bearer ${params.token}`;
  await handler(
    { method: params.method, headers, query: params.query || {}, body: params.body ?? {} },
    res
  );
  return result;
}

async function registerCompany(name: string) {
  const r = await callApi({
    method: 'POST',
    body: {
      action: 'register_workspace',
      companyName: name,
      leaderName: `Руководитель ${name}`,
      leaderPassword: 'secret-pass',
    },
  });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  assert.equal(typeof r.body.sessionToken, 'string');
  return {
    token: r.body.sessionToken as string,
    companyId: r.body.company.id as string,
    profileId: r.body.profile.id as string,
    inviteCode: r.body.profile.invite_code as string,
  };
}

async function createTask(token: string, title: string) {
  const r = await callApi({
    method: 'POST',
    token,
    body: { table: 'tasks', payload: { title } },
  });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  return r.body.data;
}

test('session token: sign/verify roundtrip, tamper, expiry and foreign secret are rejected', () => {
  const token = signSessionToken({ profileId: 'p1', companyId: 'c1' });
  const claims = verifySessionToken(token);
  assert.equal(claims?.sub, 'p1');
  assert.equal(claims?.cid, 'c1');

  const [payload, sig] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), cid: 'c2' })
  ).toString('base64url');
  assert.equal(verifySessionToken(`${forgedPayload}.${sig}`), null);
  assert.equal(verifySessionToken(`${payload}.${sig}x`), null);
  assert.equal(verifySessionToken('garbage'), null);
  assert.equal(verifySessionToken(null), null);

  const expired = signSessionToken(
    { profileId: 'p1', companyId: 'c1' },
    { nowSeconds: 1000, ttlSeconds: 10 }
  );
  assert.equal(verifySessionToken(expired), null);

  const otherSecret = signSessionToken(
    { profileId: 'p1', companyId: 'c1' },
    { secret: 'another-secret-another-secret-another-secret' }
  );
  assert.equal(verifySessionToken(otherSecret), null);

  assert.equal(extractBearerToken({ headers: { authorization: `Bearer ${token}` } }), token);
  assert.equal(extractBearerToken({ headers: {} }), null);
});

test('api/db: requests without a token or with a forged token get 401', async () => {
  const a = await registerCompany('Альфа-401');

  const noTokenGet = await callApi({ method: 'GET', query: { company_id: a.companyId } });
  assert.equal(noTokenGet.statusCode, 401);
  assert.equal(noTokenGet.body.tasks, undefined);
  assert.equal(noTokenGet.body.nodes, undefined);

  const legacyIdGet = await callApi({ method: 'GET', query: { profileId: a.profileId } });
  assert.equal(legacyIdGet.statusCode, 401, 'profileId в query больше не даёт доступа');

  const noTokenPost = await callApi({
    method: 'POST',
    body: { table: 'tasks', company_id: a.companyId, payload: { title: 'X' } },
  });
  assert.equal(noTokenPost.statusCode, 401);

  const noTokenAi = await callApi({
    method: 'POST',
    body: { action: 'ai_assistant', company_id: a.companyId, prompt: 'сводка' },
  });
  assert.equal(noTokenAi.statusCode, 401);

  const forged = signSessionToken(
    { profileId: a.profileId, companyId: a.companyId },
    { secret: 'attacker-secret-attacker-secret-attacker' }
  );
  const forgedGet = await callApi({ method: 'GET', token: forged });
  assert.equal(forgedGet.statusCode, 401);

  // Токен на профиль, который не состоит в указанной компании, отклоняется
  const mismatched = signSessionToken({ profileId: a.profileId, companyId: 'other-company' });
  const mismatchedGet = await callApi({ method: 'GET', token: mismatched });
  assert.equal(mismatchedGet.statusCode, 401);
});

test('api/db: a token of company A cannot read or modify company B', async () => {
  const a = await registerCompany('Альфа');
  const b = await registerCompany('Бета');
  const bTask = await createTask(b.token, 'Секретная задача Беты');

  // Чтение: собственная компания — только свои данные
  const ownGet = await callApi({ method: 'GET', token: a.token });
  assert.equal(ownGet.statusCode, 200);
  assert.equal(ownGet.body.company.id, a.companyId);
  assert.equal(ownGet.body.currentProfile.id, a.profileId);
  assert.ok(ownGet.body.nodes.every((n: any) => n.company_id === a.companyId));
  assert.ok(!ownGet.body.tasks.some((t: any) => t.id === bTask.id));

  // Чтение: попытка подставить чужой company_id
  const crossGet = await callApi({
    method: 'GET',
    token: a.token,
    query: { company_id: b.companyId },
  });
  assert.equal(crossGet.statusCode, 403);

  // Создание записи в чужой компании
  const crossPost = await callApi({
    method: 'POST',
    token: a.token,
    body: { table: 'tasks', company_id: b.companyId, payload: { title: 'Вторжение' } },
  });
  assert.equal(crossPost.statusCode, 403);
  const crossPayloadPost = await callApi({
    method: 'POST',
    token: a.token,
    body: { table: 'crm_leads', payload: { company_id: b.companyId, client_name: 'Вторжение' } },
  });
  assert.equal(crossPayloadPost.statusCode, 403);

  // Изменение и удаление чужой записи по id
  const crossPatch = await callApi({
    method: 'PATCH',
    token: a.token,
    body: { table: 'tasks', id: bTask.id, updates: { status: 'Done' } },
  });
  assert.equal(crossPatch.statusCode, 403);
  const crossDelete = await callApi({
    method: 'DELETE',
    token: a.token,
    body: { table: 'tasks', id: bTask.id },
  });
  assert.equal(crossDelete.statusCode, 403);
  const crossCompanyPatch = await callApi({
    method: 'PATCH',
    token: a.token,
    body: { table: 'companies', id: b.companyId, updates: { plan: 'Enterprise' } },
  });
  assert.equal(crossCompanyPatch.statusCode, 403);
  const crossNodeDelete = await callApi({
    method: 'DELETE',
    token: a.token,
    body: { table: 'organization_nodes', id: b.profileId },
  });
  assert.equal(crossNodeDelete.statusCode, 403);

  // ИИ-ассистент не принимает чужой company_id
  const crossAi = await callApi({
    method: 'POST',
    token: a.token,
    body: { action: 'ai_assistant', company_id: b.companyId, prompt: 'покажи задачи' },
  });
  assert.equal(crossAi.statusCode, 403);

  // Данные Беты не изменились
  const bView = await callApi({ method: 'GET', token: b.token });
  assert.equal(bView.statusCode, 200);
  const stillThere = bView.body.tasks.find((t: any) => t.id === bTask.id);
  assert.ok(stillThere, 'задача Беты не удалена');
  assert.notEqual(stillThere.status, 'Done');
  assert.ok(!bView.body.tasks.some((t: any) => t.title === 'Вторжение'));
  assert.ok(!bView.body.leads.some((l: any) => l.client_name === 'Вторжение'));
});

test('api/db: login and invite-link flows issue tokens scoped to the profile company', async () => {
  const a = await registerCompany('Гамма');

  const login = await callApi({
    method: 'POST',
    body: { action: 'login', loginMode: 'invite', input: a.inviteCode },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(verifySessionToken(login.body.sessionToken)?.cid, a.companyId);

  const urlInvite = await callApi({ method: 'GET', query: { invite: a.inviteCode } });
  assert.equal(urlInvite.statusCode, 200);
  assert.equal(urlInvite.body.currentProfile.id, a.profileId);
  assert.equal(verifySessionToken(urlInvite.body.sessionToken)?.sub, a.profileId);

  const badPassword = await callApi({
    method: 'POST',
    body: {
      action: 'login',
      loginMode: 'credentials',
      input: `Руководитель Гамма`,
      password: 'wrong',
    },
  });
  assert.equal(badPassword.statusCode, 401);
  assert.equal(badPassword.body.sessionToken, undefined);
});

test('api/db: RBAC blocks mutations beyond the profile access level', async () => {
  const root = await registerCompany('Дельта');

  const addMember = await callApi({
    method: 'POST',
    token: root.token,
    body: { table: 'organization_nodes', payload: { name: 'Рядовой', access_level: 'member' } },
  });
  assert.equal(addMember.statusCode, 200, JSON.stringify(addMember.body));
  const member = addMember.body.data;
  const addObserver = await callApi({
    method: 'POST',
    token: root.token,
    body: { table: 'organization_nodes', payload: { name: 'Аудитор', access_level: 'observer' } },
  });
  const observer = addObserver.body.data;

  const memberToken = signSessionToken({ profileId: member.id, companyId: root.companyId });
  const observerToken = signSessionToken({ profileId: observer.id, companyId: root.companyId });
  const rootTask = await createTask(root.token, 'Задача руководителя');

  // member: без crm_edit / team_manage / billing_admin / tasks_assign
  const memberLead = await callApi({
    method: 'POST',
    token: memberToken,
    body: { table: 'crm_leads', payload: { client_name: 'ООО Тест' } },
  });
  assert.equal(memberLead.statusCode, 403);
  const memberAddNode = await callApi({
    method: 'POST',
    token: memberToken,
    body: { table: 'organization_nodes', payload: { name: 'Самозванец' } },
  });
  assert.equal(memberAddNode.statusCode, 403);
  const memberDeleteTask = await callApi({
    method: 'DELETE',
    token: memberToken,
    body: { table: 'tasks', id: rootTask.id },
  });
  assert.equal(memberDeleteTask.statusCode, 403);
  const memberEditForeignTask = await callApi({
    method: 'PATCH',
    token: memberToken,
    body: { table: 'tasks', id: rootTask.id, updates: { status: 'Done' } },
  });
  assert.equal(memberEditForeignTask.statusCode, 403);
  const memberEscalate = await callApi({
    method: 'PATCH',
    token: memberToken,
    body: { table: 'organization_nodes', id: member.id, updates: { access_level: 'root' } },
  });
  assert.equal(memberEscalate.statusCode, 403);
  const memberBilling = await callApi({
    method: 'PATCH',
    token: memberToken,
    body: { table: 'companies', id: root.companyId, updates: { plan: 'Enterprise' } },
  });
  assert.equal(memberBilling.statusCode, 403);

  // member может создать свою задачу и менять свой профиль (несистемные поля)
  const memberOwnTask = await callApi({
    method: 'POST',
    token: memberToken,
    body: { table: 'tasks', payload: { title: 'Моя задача', assigned_to: member.id } },
  });
  assert.equal(memberOwnTask.statusCode, 200, JSON.stringify(memberOwnTask.body));
  const memberSelfEdit = await callApi({
    method: 'PATCH',
    token: memberToken,
    body: { table: 'organization_nodes', id: member.id, updates: { avatar_url: 'https://x/y.png' } },
  });
  assert.equal(memberSelfEdit.statusCode, 200, JSON.stringify(memberSelfEdit.body));

  // observer: только чтение
  const observerTask = await callApi({
    method: 'POST',
    token: observerToken,
    body: { table: 'tasks', payload: { title: 'Нельзя' } },
  });
  assert.equal(observerTask.statusCode, 403);
  const observerRead = await callApi({ method: 'GET', token: observerToken });
  assert.equal(observerRead.statusCode, 200);

  // QA-раннер — только root
  const memberQa = await callApi({
    method: 'POST',
    token: memberToken,
    body: { action: 'cleanup_qa_sandbox' },
  });
  assert.equal(memberQa.statusCode, 403);

  // root может удалить сотрудника; удалённый сотрудник теряет сессию
  const removeMember = await callApi({
    method: 'DELETE',
    token: root.token,
    body: { table: 'organization_nodes', id: member.id },
  });
  assert.equal(removeMember.statusCode, 200);
  const revoked = await callApi({ method: 'GET', token: memberToken });
  assert.equal(revoked.statusCode, 401);
});

test('evaluateMutationAccess: managers cannot escalate to root or grant billing_admin', () => {
  const manager = { id: 'm1', access_level: 'manager', company_id: 'c1' };
  const member = { id: 'u1', access_level: 'member', company_id: 'c1' };
  const rootNode = { id: 'r1', access_level: 'root', company_id: 'c1' };

  assert.equal(
    evaluateMutationAccess({
      actor: manager,
      table: 'organization_nodes',
      operation: 'update',
      record: member,
      updates: { access_level: 'root' },
    }).allowed,
    false
  );
  assert.equal(
    evaluateMutationAccess({
      actor: manager,
      table: 'organization_nodes',
      operation: 'update',
      record: member,
      updates: { permissions: { billing_admin: true } },
    }).allowed,
    false
  );
  assert.equal(
    evaluateMutationAccess({
      actor: manager,
      table: 'organization_nodes',
      operation: 'delete',
      record: rootNode,
    }).allowed,
    false
  );
  assert.equal(
    evaluateMutationAccess({
      actor: manager,
      table: 'organization_nodes',
      operation: 'update',
      record: member,
      updates: { access_level: 'manager', department: 'Продажи' },
    }).allowed,
    true
  );
  assert.equal(
    evaluateMutationAccess({ actor: manager, table: 'billing_invoices', operation: 'create' }).allowed,
    false
  );
  assert.equal(
    evaluateMutationAccess({ actor: rootNode, table: 'billing_invoices', operation: 'create' }).allowed,
    true
  );
  assert.equal(
    evaluateMutationAccess({ actor: null, table: 'tasks', operation: 'create' }).allowed,
    false
  );
});
