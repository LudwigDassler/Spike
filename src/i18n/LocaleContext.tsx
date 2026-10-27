import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { formatRoleOrDept } from '../utils/enterpriseLogic';

export type SupportedLocale = 'ru' | 'en';
export type SupportedCurrency = 'RUB' | 'USD' | 'EUR';
export type SupportedTheme = 'dark' | 'light';
export type AppLanguage = SupportedLocale;
export type AppCurrency = SupportedCurrency;

const CURRENCY_RATES_FROM_RUB: Record<SupportedCurrency, number> = {
  RUB: 1,
  USD: 1 / 92.5,
  EUR: 1 / 100.0,
};

type Dictionary = Record<string, string>;

const ru: Dictionary = {
  // Brand & Navigation
  'brand.edition': 'Enterprise',
  'nav.overview': 'Дашборд',
  'nav.tasks': 'Задачи',
  'nav.crm': 'Сделки',
  'nav.communications': 'Инфополе и Связь',
  'nav.team': 'Штат и Доступы',
  'nav.profile': 'Личный кабинет',
  'nav.workspace': 'Организация и Биллинг',

  // TopBar
  'topbar.workspace': 'Организация',
  'topbar.sync': 'Обновить данные',
  'topbar.language': 'Язык интерфейса',
  'topbar.currency': 'Валюта учета',

  // Auth Gate
  'auth.subtitle': 'Корпоративная система управления задачами, структурой компании и сделками',
  'auth.tabSignIn': 'Вход для сотрудников',
  'auth.tabRegister': 'Регистрация компании',
  'auth.signInTitle': 'Вход в рабочее пространство',
  'auth.signInDesc': 'Введите персональный код приглашения (TC-XXXX), рабочий Email, ФИО или привязанный Telegram ID.',
  'auth.identifierLabel': 'Инвайт-код, Email, ФИО или Telegram ID',
  'auth.identifierPlaceholder': 'TC-XXXX, name@company.ru или ID',
  'auth.signInBtn': 'Войти в систему',
  'auth.signingIn': 'Проверка доступа...',
  'auth.userNotFound': 'Профиль сотрудника не найден. Проверьте введенный код доступа, Email или зарегистрируйте новую организацию.',
  'auth.registerTitle': 'Создание корпоративного пространства',
  'auth.registerDesc': 'Зарегистрируйте организацию и создайте корневой профиль руководителя с полным системным допуском.',
  'auth.companyNameLabel': 'Название организации',
  'auth.companyNamePlaceholder': 'Например: ООО ТехноКонсалт',
  'auth.leaderNameLabel': 'ФИО руководителя',
  'auth.leaderNamePlaceholder': 'Например: Соколов Андрей Викторович',
  'auth.leaderTitleLabel': 'Должность в компании',
  'auth.leaderTitlePlaceholder': 'Например: Генеральный директор',
  'auth.leaderDeptLabel': 'Подразделение / Отдел',
  'auth.leaderDeptPlaceholder': 'Например: Исполнительная дирекция',
  'auth.leaderEmailLabel': 'Рабочий Email',
  'auth.leaderEmailPlaceholder': 'ceo@company.ru',
  'auth.registerBtn': 'Создать компанию и войти',
  'auth.registering': 'Инициализация пространства...',

  // Section Headers
  'header.overviewTitle': 'Дашборд организации',
  'header.overviewSubtitle': 'Ключевые показатели эффективности и сводка активных поручений',
  'header.tasksTitle': 'Реестр задач и поручений',
  'header.tasksSubtitle': 'Управление поручениями с назначением на сотрудников или подразделения и уведомлением в Telegram',
  'header.crmTitle': 'Воронка корпоративных сделок',
  'header.crmSubtitle': 'Управление контрактами, юридическими реквизитами, стадиями переговоров и выручкой',
  'header.communicationsTitle': 'Единое инфополе и Связь',
  'header.communicationsSubtitle': 'Мгновенный обмен сообщениями между сотрудниками, подразделениями и Telegram-ботом',
  'header.teamTitle': 'Штат сотрудников и Матрица доступов',
  'header.teamSubtitle': 'Конструктор подразделений, свободные должности, матрица разрешений и коды привязки',
  'header.profileTitle': 'Личный кабинет сотрудника',
  'header.profileSubtitle': 'Персональные данные, активные системные полномочия и параметры локализации',
  'header.workspaceTitle': 'Организация и Биллинг',
  'header.workspaceSubtitle': 'Профиль компании, структура подразделений, тарифный план, биллинг и выгрузка реестров в CSV',

  // Contextual Single Primary Actions (БЛОК 2)
  'actions.searchPlaceholder': 'Поиск по задачам, сделкам, сотрудникам...',
  'actions.newTask': 'Новая задача',
  'actions.newEmployee': 'Добавить сотрудника',
  'actions.newDeal': 'Новая сделка',

  // KPI Cards
  'kpi.totalTasks': 'Активные задачи',
  'kpi.completed': 'Завершено',
  'kpi.highPriority': 'высокий приоритет',
  'kpi.orgStructure': 'Штат компании',
  'kpi.telegramConnected': 'Подключено к Telegram',
  'kpi.conversionRate': 'Конверсия воронки',
  'kpi.wonDeals': 'Успешных контрактов',
  'kpi.pipelineVolume': 'Объем сделок',
  'kpi.closedWon': 'Закрыто в оплату',
  'kpi.myCompletedTasks': 'Выполнено поручений',
  'kpi.myHighPriority': 'Срочные поручения',

  // Tasks Section
  'tasks.sectionTitle': 'Корпоративные задачи',
  'tasks.myTasks': 'Только мои',
  'tasks.allPriorities': 'Все приоритеты',
  'tasks.addBtn': 'Новая задача',
  'tasks.emptyTitle': 'Активные задачи отсутствуют',
  'tasks.empty': 'Создайте задачу в веб-интерфейсе или отправьте сообщение корпоративному Telegram-боту.',
  'tasks.assignee': 'Исполнитель',
  'tasks.department': 'Отдел',
  'tasks.unassigned': 'Не назначен',
  'tasks.selfAssignedNote': 'Назначается автоматически на ваш профиль (нет права делегирования)',

  // Priorities & Statuses
  'priority.High': 'Высокий',
  'priority.Medium': 'Средний',
  'priority.Low': 'Низкий',
  'status.Todo': 'К выполнению',
  'status.In Progress': 'В работе',
  'status.Done': 'Выполнено',
  'status.Cancelled': 'Отклонено',
  'type.Task': 'Поручение',
  'type.Bug': 'Инцидент',
  'type.Epic': 'Проект',
  'type.approval': 'Согласование',
  'type.Approval': 'Согласование',

  // Access Levels
  'access.root': 'Суперадмин / Владелец',
  'access.manager': 'Руководитель направления',
  'access.member': 'Штатный сотрудник',
  'access.observer': 'Аудитор / Наблюдатель',
  'access.viewer': 'Аудитор / Наблюдатель',
  'accessShort.root': 'Полный доступ',
  'accessShort.manager': 'Руководитель',
  'accessShort.member': 'Базовый доступ',
  'accessShort.observer': 'Аудитор (Чтение)',
  'accessShort.viewer': 'Аудитор (Чтение)',

  // 7 Granular Permissions & Clean Business Descriptions (БЛОК 1 — без ключей БД)
  'perm.title': 'Матрица индивидуальных разрешений',
  'perm.tasks_view_all': 'Видеть все задачи компании (иначе — только свои)',
  'perm.tasks_assign': 'Назначать и делегировать задачи другим сотрудникам',
  'perm.crm_view': 'Просматривать вкладку «Сделки» и финансовые показатели',
  'perm.crm_edit': 'Создавать, редактировать и менять этапы сделок CRM',
  'perm.team_manage': 'Управлять разделом «Штат и Доступы» (добавление/удаление)',
  'perm.data_export': 'Выгружать корпоративные отчеты и реестры в CSV',
  'perm.billing_admin': 'Управлять разделом «Организация и Биллинг» и тарифами',
  'permDesc.tasks_view_all': 'Доступ к полному реестру поручений всех подразделений организации',
  'permDesc.tasks_assign': 'Право поручать задачи коллегам и целым отделам с уведомлением в Telegram',
  'permDesc.crm_view': 'Просмотр коммерческой воронки, сумм контрактов и аналитики конверсии',
  'permDesc.crm_edit': 'Регистрация новых сделок, ведение реквизитов и перевод этапов воронки',
  'permDesc.team_manage': 'Приглашение сотрудников, настройка подразделений и распределение прав',
  'permDesc.data_export': 'Формирование и скачивание табличных выгрузок CSV для отчетности',
  'permDesc.billing_admin': 'Конфигурация реквизитов организации, тарифного плана и платежных шлюзов',
  'perm.statusGranted': 'Разрешено',
  'perm.statusRestricted': 'Ограничено',

  // Permissions Matrix Modal (БЛОК 1 — без слова БД)
  'permModal.btnLabel': 'Права доступа',
  'permModal.title': 'Матрица прав сотрудника',
  'permModal.subtitle': 'Выберите базовый пресет уровня доступа или настройте индивидуальные разрешения для должности сотрудника.',
  'permModal.presetLabel': 'Базовый контур доступа (пресет)',
  'permModal.rootNotice': 'Для уровня Полный доступ (Суперадмин) все 7 системных разрешений включены принудительно.',
  'permModal.saveBtn': 'Сохранить изменения',

  // Department Constructor (БЛОК 2)
  'dept.sectionTitle': 'Структура подразделений компании',
  'dept.cardTitle': 'Структура подразделений компании',
  'dept.subtitle': 'Зарегистрируйте отделы и подразделения организации для распределения сотрудников, задач, сделок и групповых оповещений в Telegram.',
  'dept.cardSubtitle': 'Зарегистрируйте отделы и подразделения организации для распределения сотрудников, задач, сделок и групповых оповещений в Telegram.',
  'dept.placeholder': 'Название нового отдела (например: Финансовый отдел, ПТО, Логистика)...',
  'dept.inputPlaceholder': 'Название нового отдела (например: Финансовый отдел, ПТО, Логистика)...',
  'dept.addBtn': 'Зарегистрировать отдел',
  'dept.empty': 'Подразделения еще не зарегистрированы. Создайте первый отдел компании для распределения сотрудников и задач.',
  'dept.customOption': '+ Создать новый отдел...',
  'dept.customInputPlaceholder': 'Введите название нового подразделения...',
  'dept.selectNone': 'Без привязки к отделу',
  'dept.noneOption': 'Без привязки к отделу',
  'dept.allDeptNotifyHint': 'При выборе отдела без конкретного исполнителя уведомление в Telegram получат все сотрудники этого подразделения.',
  'dept.addedToast': 'Новое подразделение зарегистрировано в структуре компании.',
  'dept.removedToast': 'Подразделение удалено из структуры компании.',

  // Team Section
  'team.sectionTitle': 'Штатное расписание и матрица доступов',
  'team.addBtn': 'Добавить сотрудника',
  'team.emptyTitle': 'Штат сотрудников не заполнен',
  'team.empty': 'Добавьте сотрудников с указанием их должности, подразделения и уровня системного допуска.',
  'team.colEmployee': 'ФИО и Email',
  'team.colJobTitle': 'Должность и Подразделение',
  'team.colAccess': 'Контур допуска и Полномочия',
  'team.colInviteCode': 'Код привязки',
  'team.colTelegram': 'Связь с Telegram',
  'team.colActions': 'Управление',
  'team.connected': 'Синхронизирован',
  'team.pendingInvite': 'Ожидает активации',
  'team.inviteLinkBtn': 'Инвайт',
  'team.permissionsBtn': 'Права доступа',
  'team.noDepartment': 'Отдел не указан',
  'team.activePermsCount': 'активных прав из 7',

  // CRM Section (БЛОК 3)
  'crm.sectionTitle': 'Реестр коммерческих сделок',
  'crm.addBtn': 'Новая сделка',
  'crm.emptyTitle': 'Воронка сделок пуста',
  'crm.empty': 'Зарегистрируйте первую коммерческую сделку для отслеживания стадий переговоров и выручки.',
  'crm.colClient': 'Клиент и Договор',
  'crm.colRequisites': 'Реквизиты (ИНН / VAT)',
  'crm.colResponsible': 'Ответственный / Отдел',
  'crm.colAssigneeDept': 'Ответственный / Отдел',
  'crm.colContact': 'Контактные данные',
  'crm.colStage': 'Этап воронки',
  'crm.colAmount': 'Сумма контракта',
  'crm.colControl': 'Управление',
  'crm.readOnlyBadge': 'Режим чтения (Аудитор)',
  'stage.New': 'Новая',
  'stage.Negotiation': 'Переговоры',
  'stage.Won': 'Выиграна',
  'stage.Lost': 'Закрыта',

  // Communications Section (БЛОК 4 — Единое инфополе и Связь)
  'comm.sectionTitle': 'Корпоративный поток сообщений',
  'comm.feedTitle': 'Корпоративный поток сообщений',
  'comm.composeTitle': 'Новое сообщение / Оповещение',
  'comm.composeSubtitle': 'Отправка мгновенных сообщений коллегам, отделам или всей компании с доставкой в Telegram',
  'comm.scopeLabel': 'Контур получателей',
  'comm.scopeDirect': 'Лично сотруднику',
  'comm.scopeDepartment': 'В подразделение (Отдел)',
  'comm.scopeBroadcast': 'Общее оповещение по компании',
  'comm.selectColleague': 'Выберите получателя',
  'comm.selectEmployee': 'Выберите сотрудника',
  'comm.selectDepartment': 'Выберите подразделение',
  'comm.messageLabel': 'Текст сообщения',
  'comm.messagePlaceholder': 'Введите текст рабочего сообщения, поручения или циркуляра...',
  'comm.urgentLabel': 'Высокая важность (Срочное уведомление в Telegram)',
  'comm.sendBtn': 'Отправить сообщение',
  'comm.sendingBtn': 'Отправка...',
  'comm.sentToast': 'Сообщение опубликовано и отправлено получателям в Telegram.',
  'comm.emptyTitle': 'Информационный поток пуст',
  'comm.emptyDesc': 'В информационном потоке пока нет сообщений. Отправьте первое сообщение коллеге или подразделению.',
  'comm.emptyFeed': 'В информационный потоке пока нет сообщений. Отправьте первое сообщение коллеге или подразделению.',
  'comm.filterAll': 'Все',
  'comm.filterDirect': 'Личные',
  'comm.filterDept': 'Отделы',
  'comm.filterEntities': 'Задачи и Сделки',
  'comm.badgeDirect': 'Личное сообщение',
  'comm.badgeDepartment': 'Отдел',
  'comm.badgeDept': 'Отдел',
  'comm.badgeBroadcast': 'Циркуляр по компании',
  'comm.badgeTask': 'Задача',
  'comm.badgeLead': 'Сделка CRM',
  'comm.badgeDeal': 'Сделка CRM',
  'comm.urgentTag': 'СРОЧНО',
  'comm.toRecipient': 'Кому:',
  'comm.allEmployees': 'Все сотрудники компании',
  'comm.replyAction': 'Ответить',
  'comm.replyQuick': 'Ответить сотруднику',

  // Profile Tab (Личный кабинет)
  'profile.cardTitle': 'Персональная карточка сотрудника',
  'profile.cardSubtitle': 'Контактные данные и кадровая привязка в структуре компании',
  'profile.fullName': 'ФИО сотрудника',
  'profile.jobTitle': 'Должность в компании',
  'profile.department': 'Подразделение / Отдел',
  'profile.email': 'Корпоративный Email',
  'profile.lockedByAdmin': 'Изменяется администратором',
  'profile.saveBtn': 'Сохранить изменения профиля',
  'profile.savingBtn': 'Сохранение...',
  'profile.savedToast': 'Данные личного профиля успешно обновлены.',
  'profile.securityTitle': 'Синхронизация Telegram и Локализация',
  'profile.accessLevelLabel': 'Текущий контур допуска',
  'profile.telegramStatusLabel': 'Статус привязки Telegram-аккаунта',
  'profile.telegramConnectedId': 'Привязан (ID:',
  'profile.telegramNotConnected': 'Не привязан к Telegram-боту',
  'profile.syncLinkLabel': 'Персональная ссылка синхронизации с ботом',
  'profile.permissionsCardTitle': 'Ваши полномочия в системе',
  'profile.permissionsCardDesc': 'Активные контуры доступа для вашей текущей должности:',
  'profile.activePermissionsTitle': 'Ваши полномочия в системе',
  'profile.activePermissionsDesc': 'Активные контуры доступа для вашей текущей должности:',
  'profile.preferencesTitle': 'Локализация и Валюта расчетов',
  'profile.preferencesSubtitle': 'Настройка языка интерфейса и базовой валюты отображения сделок',
  'profile.interfaceLang': 'Язык интерфейса',
  'profile.displayCurrency': 'Валюта расчетов и аналитики',
  'profile.signOutBtn': 'Выйти',

  // Slide-over Detail Drawer (БЛОК 2, 3, 4)
  'drawer.taskHeader': 'Карточка задачи',
  'drawer.dealHeader': 'Карточка коммерческой сделки',
  'drawer.openDetails': 'Комментарий',
  'drawer.createdAt': 'Дата создания',
  'drawer.author': 'Постановщик / Автор',
  'drawer.assignee': 'Ответственный исполнитель',
  'drawer.department': 'Профильное подразделение',
  'drawer.status': 'Текущий статус',
  'drawer.priority': 'Приоритет',
  'drawer.dealAmount': 'Сумма контракта',
  'drawer.dealContact': 'Контакт контрагента',
  'drawer.requisitesTitle': 'Юридические и договорные реквизиты',
  'drawer.dealRequisites': 'Юридические и договорные реквизиты',
  'drawer.jurisdiction': 'Юрисдикция',
  'drawer.contractNumber': 'Номер договора / Счета (PO #)',
  'drawer.saveRequisitesBtn': 'Сохранить реквизиты',
  'drawer.notesLabel': 'Рабочая заметка / Резюме',
  'drawer.notesPlaceholder': 'Добавьте резюме переговоров, технические требования или статус согласования...',
  'drawer.saveNotesBtn': 'Сохранить заметку',
  'drawer.notesSavedToast': 'Изменения сохранены в системе.',
  'drawer.savedToast': 'Изменения сохранены в системе.',
  'drawer.threadTitle': 'Живая лента комментариев и связь с Telegram',
  'drawer.threadEmpty': 'Комментариев по данной записи пока нет. Напишите сообщение — ответственный получит уведомление в Telegram.',
  'drawer.threadPlaceholder': 'Написать рабочий комментарий по записи...',
  'drawer.threadSendBtn': 'Отправить',
  'drawer.historyTitle': 'Журнал состояния записи',
  'drawer.historyCreated': 'Запись зарегистрирована в реестре компании',
  'drawer.historyCurrent': 'Актуальный статус в системе:',
  'drawer.close': 'Закрыть панель',

  // Workspace & Billing Tab
  'workspace.orgSection': 'Профиль организации и Локализация',
  'workspace.companyName': 'Наименование организации',
  'workspace.currentPlan': 'Тарифный план подписки',
  'workspace.planTrialDesc': 'Стартовый контур: до 5 сотрудников, базовый реестр задач, CRM и Telegram-бот.',
  'workspace.planBusinessDesc': 'Коммерческий контур: до 50 сотрудников, матрица прав доступа, Telegram Push и экспорт CSV.',
  'workspace.planEnterpriseDesc': 'Корпоративный кластер: безлимит сотрудников, SLA 99.9%, выделенный контур и аудит.',
  'workspace.activeTier': 'Активный тариф',
  'workspace.upgradeBtn': 'Выбрать тариф',
  'workspace.billingSection': 'Платежный контур и Биллинг',
  'workspace.gatewayGlobal': 'Global: Stripe / Paddle',
  'workspace.gatewayGlobalDesc': 'Международный биллинг в USD и EUR по корпоративным картам и инвойсам.',
  'workspace.gatewayRu': 'РФ: ЮKassa / Счет по реквизитам',
  'workspace.gatewayRuDesc': 'Оплата в рублях по счету для юридических лиц (ЭДО Диадок / СБИС) или через ЮKassa.',
  'workspace.botConfigTitle': 'Имя корпоративного Telegram-бота',
  'workspace.botConfigDesc': 'Укажите имя бота (без символа @) для формирования ссылок привязки сотрудников.',
  'workspace.exportSection': 'Экспорт корпоративных реестров (CSV)',
  'workspace.exportDesc': 'Выгрузка актуальных таблиц системы в кодировке UTF-8 для внешней отчетности.',
  'workspace.exportDealsCsv': 'Выгрузить сделки (CSV)',
  'workspace.exportTasksCsv': 'Выгрузить задачи (CSV)',
  'workspace.exportTeamCsv': 'Выгрузить штат (CSV)',

  // Modals (AddRecordModal — БЛОК 2 и БЛОК 3)
  'modal.newTaskTitle': 'Новая корпоративная задача',
  'modal.newEmployeeTitle': 'Добавление сотрудника в штат',
  'modal.newDealTitle': 'Новая коммерческая сделка',
  'modal.taskTitleLabel': 'Формулировка задачи',
  'modal.taskTitlePlaceholder': 'Например: Согласовать смету и график поставок',
  'modal.taskDescLabel': 'Описание / Рабочая заметка',
  'modal.taskDescPlaceholder': 'Дополнительные вводные для исполнителя или отдела...',
  'modal.taskTypeLabel': 'Тип записи',
  'modal.taskPriorityLabel': 'Приоритет',
  'modal.taskStatusLabel': 'Статус',
  'modal.taskAssigneeLabel': 'Ответственный сотрудник',
  'modal.taskDepartmentLabel': 'Подразделение (Отдел)',
  'modal.unassignedDeptBroadcast': 'Не назначен (оповестить выбранный отдел)',
  'modal.taskDepartmentHint': 'Если конкретный сотрудник не выбран, уведомление в Telegram получат все сотрудники указанного отдела.',
  'modal.empNameLabel': 'ФИО сотрудника',
  'modal.empNamePlaceholder': 'Например: Волков Дмитрий Сергеевич',
  'modal.empRoleLabel': 'Должность в компании',
  'modal.empRolePlaceholder': 'Например: Главный инженер, Экономист, Юрист',
  'modal.empDeptLabel': 'Подразделение / Отдел',
  'modal.empDeptPlaceholder': 'Например: Финансовый отдел, ПТО, Коммерческий блок',
  'modal.empAccessLabel': 'Базовый уровень системного допуска',
  'modal.empEmailLabel': 'Корпоративный Email',
  'modal.empTgLabel': 'Telegram ID',
  'modal.dealClientLabel': 'Компания / Контрагент',
  'modal.dealClientPlaceholder': 'Например: АО СтройИнвест Холдинг',
  'modal.dealTitleLabel': 'Предмет договора / проект',
  'modal.dealTitlePlaceholder': 'Например: Поставка лицензий и внедрение контура',
  'modal.dealAmountLabel': 'Сумма контракта',
  'modal.dealStageLabel': 'Стадия воронки',
  'modal.dealJurisdictionLabel': 'Юрисдикция контрагента',
  'modal.jurisdictionLabel': 'Юрисдикция контрагента',
  'modal.jurisdictionRu': 'РФ и СНГ (ИНН / КПП)',
  'modal.jurisdictionRU': 'РФ и СНГ (ИНН / КПП)',
  'modal.jurisdictionGlobal': 'International (VAT / EIN / Reg. No.)',
  'modal.taxIdRu': 'ИНН контрагента',
  'modal.taxIdRuPlaceholder': '7701234567',
  'modal.regNumRu': 'КПП / ОГРН',
  'modal.regNumRuPlaceholder': '770101001 / 1027700123456',
  'modal.taxIdGlobal': 'Tax ID / VAT / EIN',
  'modal.taxIdGlobalPlaceholder': 'DE123456789 / 12-3456789',
  'modal.regNumGlobal': 'Registration No. (CRN)',
  'modal.regNumGlobalPlaceholder': 'HRB 123456 / 09876543',
  'modal.contractNumberLabel': 'Номер договора / Счета (PO #)',
  'modal.contractNumberPlaceholder': 'Например: ДГ-2026/104 или PO-8841',
  'modal.dealAssigneeLabel': 'Ответственный менеджер',
  'modal.dealDepartmentLabel': 'Профильный отдел',
  'modal.dealContactLabel': 'Контактное лицо (Телефон / Email / Telegram)',
  'modal.dealContactPlaceholder': '+7 (495) 000-00-00 / contact@company.ru',
  'modal.dealNotesLabel': 'Комментарий по сделке',
  'modal.dealNotesPlaceholder': 'Условия оплаты, ЛПР, сроки подписания...',
  'modal.cancel': 'Отмена',
  'modal.submit': 'Сохранить запись',
  'modal.saving': 'Сохранение...',

  // Invite Code & Deep-Link Modal
  'invite.modalTitle': 'Код доступа и ссылка синхронизации сотрудника',
  'invite.modalSubtitle': 'Отправьте сотруднику прямую ссылку или персональный код. При переходе по ссылке бот автоматически привяжет его Telegram к профилю в системе.',
  'invite.codeLabel': 'Персональный инвайт-код',
  'invite.deepLinkLabel': 'Прямая ссылка синхронизации Telegram',
  'invite.copyCode': 'Скопировать код',
  'invite.copyLink': 'Скопировать ссылку',
  'invite.copied': 'Скопировано',
  'invite.step1': '1. Передайте сотруднику инвайт-код для входа в веб-панель или прямую ссылку Telegram.',
  'invite.step2': '2. При нажатии кнопки запуска в боте профиль автоматически синхронизируется с Telegram ID.',
  'invite.step3': '3. В сообщении бота сотруднику будут доступны команды согласно его матрице прав.',
  'invite.close': 'Закрыть окно',
  'invite.doneBtn': 'Готово',

  // ConfirmDialog
  'confirm.cancel': 'Отмена',
  'confirm.confirm': 'Подтвердить',
  'confirm.processing': 'Выполнение...',
  'confirm.deleteTaskTitle': 'Подтверждение удаления задачи',
  'confirm.deleteTaskDesc': 'Выбранная задача будет безвозвратно удалена из реестра организации. Подтвердите действие.',
  'confirm.deleteEmployeeTitle': 'Удаление профиля сотрудника',
  'confirm.deleteEmployeeDesc': 'Профиль сотрудника, его права доступа и привязка Telegram будут удалены из системы.',
  'confirm.deleteDealTitle': 'Удаление карточки сделки',
  'confirm.deleteDealDesc': 'Запись о коммерческой сделке будет безвозвратно удалена из реестра CRM.',
  'confirm.criticalStatusTitle': 'Подтверждение изменения полномочий или статуса',
  'confirm.criticalStatusDesc': 'Вы изменяете уровень системного допуска сотрудника или переводите сделку в закрытый статус. Подтвердите операцию.',
  'confirm.signOutTitle': 'Завершение корпоративной сессии',
  'confirm.signOutDesc': 'Вы действительно хотите выйти из учетной записи сотрудника?',

  // Notifications
  'toast.pushSent': 'Уведомление отправлено в Telegram.',
  'toast.messageSent': 'Сообщение доставлено в инфополе и отправлено в Telegram.',
  'toast.deptUpdated': 'Структура подразделений организации обновлена.',
  'toast.planUpdated': 'Тарифный план организации обновлен.',
  'toast.gatewayUpdated': 'Платежный контур биллинга сохранен.',
  'toast.csvExported': 'Файл CSV сформирован и загружен.',
  'toast.permissionsUpdated': 'Матрица прав доступа сотрудника сохранена.',
  'system.loading': 'Загрузка корпоративного пространства TedCloud...',
  'system.connectionError': 'Ошибка обмена данными с сервером',
  'system.retry': 'Повторить попытку',
  'system.resetCacheBtn': 'Сбросить кэш сессии и перезагрузить',
  'common.generalScope': 'Общий контур',
  'common.unassigned': 'Не назначен',
  'theme.dark': 'Темная тема',
  'theme.light': 'Светлая тема',
};

const en: Dictionary = {
  // Brand & Navigation
  'brand.edition': 'Enterprise',
  'nav.overview': 'Overview',
  'nav.tasks': 'Tasks',
  'nav.crm': 'CRM Deals',
  'nav.communications': 'Communications',
  'nav.team': 'Team & Access',
  'nav.profile': 'My Profile',
  'nav.workspace': 'Workspace & Billing',

  // TopBar
  'topbar.workspace': 'Organization',
  'topbar.sync': 'Refresh Data',
  'topbar.language': 'Interface Language',
  'topbar.currency': 'Display Currency',

  // Auth Gate
  'auth.subtitle': 'Enterprise task governance, organizational structure, and B2B CRM platform',
  'auth.tabSignIn': 'Employee Sign In',
  'auth.tabRegister': 'Create Workspace',
  'auth.signInTitle': 'Sign in to your workspace',
  'auth.signInDesc': 'Enter your personal invite code (TC-XXXX), corporate Email, full name, or linked Telegram ID.',
  'auth.identifierLabel': 'Invite Code, Email, Name, or Telegram ID',
  'auth.identifierPlaceholder': 'TC-XXXX, name@company.com or ID',
  'auth.signInBtn': 'Sign In',
  'auth.signingIn': 'Verifying credentials...',
  'auth.userNotFound': 'Employee profile not found. Please verify your invite code or email, or create a new company workspace.',
  'auth.registerTitle': 'Create Organization Workspace',
  'auth.registerDesc': 'Register your company and initialize the root executive profile with full administrative access.',
  'auth.companyNameLabel': 'Organization Name',
  'auth.companyNamePlaceholder': 'e.g. Apex Engineering Group',
  'auth.leaderNameLabel': 'Executive Full Name',
  'auth.leaderNamePlaceholder': 'e.g. Andrew Sokolov',
  'auth.leaderTitleLabel': 'Job Title / Position',
  'auth.leaderTitlePlaceholder': 'e.g. Chief Executive Officer',
  'auth.leaderDeptLabel': 'Department / Division',
  'auth.leaderDeptPlaceholder': 'e.g. Executive Management',
  'auth.leaderEmailLabel': 'Corporate Email',
  'auth.leaderEmailPlaceholder': 'ceo@company.com',
  'auth.registerBtn': 'Create Workspace & Continue',
  'auth.registering': 'Provisioning workspace...',

  // Section Headers
  'header.overviewTitle': 'Executive Overview',
  'header.overviewSubtitle': 'Key performance metrics and active task summary',
  'header.tasksTitle': 'Corporate Task Registry',
  'header.tasksSubtitle': 'Assign tasks to specific employees or entire departments with instant Telegram notifications',
  'header.crmTitle': 'Commercial Deal Pipeline',
  'header.crmSubtitle': 'Manage B2B contracts, legal tax requisites, negotiation stages, and pipeline value',
  'header.communicationsTitle': 'Workspace Feed & Communications',
  'header.communicationsSubtitle': 'Real-time messaging across employees, departments, and the corporate Telegram bot',
  'header.teamTitle': 'Team Directory & Access Matrix',
  'header.teamSubtitle': 'Custom department constructor, job titles, granular 7-flag permission matrix, and invite codes',
  'header.profileTitle': 'My Employee Profile',
  'header.profileSubtitle': 'Personal details, active system permissions, and localization preferences',
  'header.workspaceTitle': 'Workspace & Billing',
  'header.workspaceSubtitle': 'Company profile, department structure, subscription tier, payment contour, and CSV export',

  // Contextual Single Primary Actions
  'actions.searchPlaceholder': 'Search tasks, deals, employees...',
  'actions.newTask': 'New Task',
  'actions.newEmployee': 'Add Member',
  'actions.newDeal': 'New Deal',

  // KPI Cards
  'kpi.totalTasks': 'Open Tasks',
  'kpi.completed': 'Completed',
  'kpi.highPriority': 'high priority',
  'kpi.orgStructure': 'Team Size',
  'kpi.telegramConnected': 'Telegram Linked',
  'kpi.conversionRate': 'Pipeline Conversion',
  'kpi.wonDeals': 'Closed Won Deals',
  'kpi.pipelineVolume': 'Pipeline Value',
  'kpi.closedWon': 'Closed Won',
  'kpi.myCompletedTasks': 'Completed Tasks',
  'kpi.myHighPriority': 'High Priority Open',

  // Tasks Section
  'tasks.sectionTitle': 'Organization Tasks',
  'tasks.myTasks': 'Only Mine',
  'tasks.allPriorities': 'All Priorities',
  'tasks.addBtn': 'New Task',
  'tasks.emptyTitle': 'No tasks registered',
  'tasks.empty': 'Create a task in the web console or send a message to the corporate Telegram bot.',
  'tasks.assignee': 'Assignee',
  'tasks.department': 'Department',
  'tasks.unassigned': 'Unassigned',
  'tasks.selfAssignedNote': 'Automatically assigned to you (delegation permission required)',

  // Priorities & Statuses
  'priority.High': 'High',
  'priority.Medium': 'Medium',
  'priority.Low': 'Low',
  'status.Todo': 'To Do',
  'status.In Progress': 'In Progress',
  'status.Done': 'Completed',
  'status.Cancelled': 'Rejected',
  'type.Task': 'Task',
  'type.Bug': 'Issue',
  'type.Epic': 'Initiative',
  'type.approval': 'Approval',
  'type.Approval': 'Approval',

  // Access Levels
  'access.root': 'Superadmin / Owner',
  'access.manager': 'Department Lead',
  'access.member': 'Staff Member',
  'access.observer': 'Auditor / Read-Only',
  'access.viewer': 'Auditor / Read-Only',
  'accessShort.root': 'Full Access',
  'accessShort.manager': 'Manager',
  'accessShort.member': 'Basic Access',
  'accessShort.observer': 'Auditor (Read-Only)',
  'accessShort.viewer': 'Auditor (Read-Only)',

  // 7 Granular Permissions & Clean Business Descriptions
  'perm.title': 'Granular Permission Matrix',
  'perm.tasks_view_all': 'View all company tasks (otherwise only own tasks)',
  'perm.tasks_assign': 'Assign and delegate tasks to other employees',
  'perm.crm_view': 'View CRM Deals tab and financial metrics',
  'perm.crm_edit': 'Create, edit, and update CRM deal stages',
  'perm.team_manage': 'Access Team & Access tab (add/remove members)',
  'perm.data_export': 'Export corporate registries to CSV',
  'perm.billing_admin': 'Access Workspace & Billing and modify company settings',
  'permDesc.tasks_view_all': 'Full visibility into tasks across all organizational departments',
  'permDesc.tasks_assign': 'Delegate tasks to colleagues or entire departments with Telegram Push',
  'permDesc.crm_view': 'Inspect the B2B commercial pipeline, contract values, and conversion KPIs',
  'permDesc.crm_edit': 'Register new contracts, edit legal requisites, and update pipeline stages',
  'permDesc.team_manage': 'Invite staff members, configure departments, and manage role permissions',
  'permDesc.data_export': 'Generate and download UTF-8 CSV reports for external analytics',
  'permDesc.billing_admin': 'Manage organization profile, subscription tier, and payment gateways',
  'perm.statusGranted': 'Granted',
  'perm.statusRestricted': 'Restricted',

  // Permissions Matrix Modal
  'permModal.btnLabel': 'Access Rights',
  'permModal.title': 'Employee Permission Matrix',
  'permModal.subtitle': 'Select a base access contour preset or customize individual permissions for this employee.',
  'permModal.presetLabel': 'Base Access Level (Preset)',
  'permModal.rootNotice': 'For Full Access (Superadmin), all 7 system permissions are permanently enabled.',
  'permModal.saveBtn': 'Save Permissions',

  // Department Constructor
  'dept.sectionTitle': 'Organizational Structure',
  'dept.cardTitle': 'Organizational Structure',
  'dept.subtitle': 'Register company departments to assign staff, tasks, CRM deals, and broadcast Telegram alerts.',
  'dept.cardSubtitle': 'Register company departments to assign staff, tasks, CRM deals, and broadcast Telegram alerts.',
  'dept.placeholder': 'New department name (e.g. Finance, Engineering, Legal)...',
  'dept.inputPlaceholder': 'New department name (e.g. Finance, Engineering, Legal)...',
  'dept.addBtn': 'Register Department',
  'dept.empty': 'No departments registered yet. Create your first department above.',
  'dept.customOption': '+ Create new department...',
  'dept.customInputPlaceholder': 'Enter new department name...',
  'dept.selectNone': 'No specific department',
  'dept.noneOption': 'No specific department',
  'dept.allDeptNotifyHint': 'When a department is selected without a specific assignee, all Telegram-linked members of that department will be notified.',
  'dept.addedToast': 'New department registered in organization structure.',
  'dept.removedToast': 'Department removed from organization structure.',

  // Team Section
  'team.sectionTitle': 'Organization Directory & Permissions',
  'team.addBtn': 'Add Member',
  'team.emptyTitle': 'No team members found',
  'team.empty': 'Add employees with their custom job titles, departments, and system access levels.',
  'team.colEmployee': 'Name & Email',
  'team.colJobTitle': 'Job Title & Department',
  'team.colAccess': 'Access Contour & Permissions',
  'team.colInviteCode': 'Invite Code',
  'team.colTelegram': 'Telegram Link',
  'team.colActions': 'Actions',
  'team.connected': 'Connected',
  'team.pendingInvite': 'Pending Activation',
  'team.inviteLinkBtn': 'Invite',
  'team.permissionsBtn': 'Permissions',
  'team.noDepartment': 'No department specified',
  'team.activePermsCount': 'of 7 permissions active',

  // CRM Section
  'crm.sectionTitle': 'Commercial Deal Registry',
  'crm.addBtn': 'New Deal',
  'crm.emptyTitle': 'No deals in pipeline',
  'crm.empty': 'Register your first commercial deal to track negotiation stages and revenue.',
  'crm.colClient': 'Client & Contract',
  'crm.colRequisites': 'Tax ID / Requisites',
  'crm.colResponsible': 'Manager / Dept',
  'crm.colAssigneeDept': 'Manager / Dept',
  'crm.colContact': 'Contact Details',
  'crm.colStage': 'Stage',
  'crm.colAmount': 'Contract Amount',
  'crm.colControl': 'Control',
  'crm.readOnlyBadge': 'Read-Only Mode (Auditor)',
  'stage.New': 'New',
  'stage.Negotiation': 'Negotiation',
  'stage.Won': 'Won',
  'stage.Lost': 'Lost',

  // Communications Section
  'comm.sectionTitle': 'Corporate Communications Feed',
  'comm.feedTitle': 'Corporate Communications Feed',
  'comm.composeTitle': 'Send Message / Broadcast',
  'comm.composeSubtitle': 'Send instant messages to colleagues, departments, or the entire company with Telegram delivery',
  'comm.scopeLabel': 'Recipient Scope',
  'comm.scopeDirect': 'Direct to Employee',
  'comm.scopeDepartment': 'To Department',
  'comm.scopeBroadcast': 'Company-Wide Broadcast',
  'comm.selectColleague': 'Select Recipient',
  'comm.selectEmployee': 'Select Employee',
  'comm.selectDepartment': 'Select Department',
  'comm.messageLabel': 'Message Content',
  'comm.messagePlaceholder': 'Write a message, operational update, or company announcement...',
  'comm.urgentLabel': 'High Importance (Urgent Telegram Notification)',
  'comm.sendBtn': 'Send Message',
  'comm.sendingBtn': 'Sending...',
  'comm.sentToast': 'Message published and sent to recipients via Telegram.',
  'comm.emptyTitle': 'No messages yet',
  'comm.emptyDesc': 'No messages in the workspace stream yet. Send the first message to a colleague or department.',
  'comm.emptyFeed': 'No messages in the workspace stream yet. Send the first message to a colleague or department.',
  'comm.filterAll': 'All',
  'comm.filterDirect': 'Direct',
  'comm.filterDept': 'Departments',
  'comm.filterEntities': 'Tasks & Deals',
  'comm.badgeDirect': 'Direct',
  'comm.badgeDepartment': 'Department',
  'comm.badgeDept': 'Department',
  'comm.badgeBroadcast': 'Broadcast',
  'comm.badgeTask': 'Task',
  'comm.badgeLead': 'CRM Deal',
  'comm.badgeDeal': 'CRM Deal',
  'comm.urgentTag': 'URGENT',
  'comm.toRecipient': 'To:',
  'comm.allEmployees': 'All Company Members',
  'comm.replyAction': 'Reply',
  'comm.replyQuick': 'Reply to member',

  // Profile Tab
  'profile.cardTitle': 'Employee Profile Card',
  'profile.cardSubtitle': 'Contact details and position in the organization structure',
  'profile.fullName': 'Full Name',
  'profile.jobTitle': 'Job Title / Position',
  'profile.department': 'Department / Division',
  'profile.email': 'Corporate Email',
  'profile.lockedByAdmin': 'Managed by administrator',
  'profile.saveBtn': 'Save Profile Changes',
  'profile.savingBtn': 'Saving...',
  'profile.savedToast': 'Personal profile updated successfully.',
  'profile.securityTitle': 'Telegram Synchronization & Preferences',
  'profile.accessLevelLabel': 'System Access Contour',
  'profile.telegramStatusLabel': 'Telegram Account Binding',
  'profile.telegramConnectedId': 'Connected (ID:',
  'profile.telegramNotConnected': 'Not linked to Telegram bot',
  'profile.syncLinkLabel': 'Personal Bot Synchronization Link',
  'profile.permissionsCardTitle': 'Your System Permissions',
  'profile.permissionsCardDesc': 'Active access contours assigned to your profile:',
  'profile.activePermissionsTitle': 'Your System Permissions',
  'profile.activePermissionsDesc': 'Active access contours assigned to your profile:',
  'profile.preferencesTitle': 'Localization & Display Currency',
  'profile.preferencesSubtitle': 'Configure interface language and analytical currency',
  'profile.interfaceLang': 'Interface Language',
  'profile.displayCurrency': 'Display Currency',
  'profile.signOutBtn': 'Sign Out',

  // Slide-over Detail Drawer
  'drawer.taskHeader': 'Task Details',
  'drawer.dealHeader': 'Commercial Deal Details',
  'drawer.openDetails': 'Comment',
  'drawer.createdAt': 'Created Date',
  'drawer.author': 'Created By / Author',
  'drawer.assignee': 'Assigned To',
  'drawer.department': 'Assigned Department',
  'drawer.status': 'Current Status',
  'drawer.priority': 'Priority',
  'drawer.dealAmount': 'Contract Amount',
  'drawer.dealContact': 'Client Contact',
  'drawer.requisitesTitle': 'Legal & Contract Requisites',
  'drawer.dealRequisites': 'Legal & Contract Requisites',
  'drawer.jurisdiction': 'Jurisdiction',
  'drawer.contractNumber': 'Contract / Invoice No. (PO #)',
  'drawer.saveRequisitesBtn': 'Save Requisites',
  'drawer.notesLabel': 'Executive Summary / Working Note',
  'drawer.notesPlaceholder': 'Add negotiation notes, technical requirements, or approval status...',
  'drawer.saveNotesBtn': 'Save Note',
  'drawer.notesSavedToast': 'Changes saved to workspace.',
  'drawer.savedToast': 'Changes saved to workspace.',
  'drawer.threadTitle': 'Live Comment Stream & Telegram Sync',
  'drawer.threadEmpty': 'No comments on this record yet. Post a comment to notify the assignee on Telegram.',
  'drawer.threadPlaceholder': 'Write a comment on this record...',
  'drawer.threadSendBtn': 'Send',
  'drawer.historyTitle': 'Record Status Log',
  'drawer.historyCreated': 'Record registered in corporate registry',
  'drawer.historyCurrent': 'Active system state:',
  'drawer.close': 'Close Drawer',

  // Workspace & Billing Tab
  'workspace.orgSection': 'Organization Profile & Localization',
  'workspace.companyName': 'Organization Name',
  'workspace.currentPlan': 'Subscription Plan Tier',
  'workspace.planTrialDesc': 'Starter contour: up to 5 members, task registry, CRM pipeline, and Telegram bot.',
  'workspace.planBusinessDesc': 'Commercial contour: up to 50 members, granular access matrix, Telegram Push, and CSV exports.',
  'workspace.planEnterpriseDesc': 'Enterprise cluster: unlimited members, 99.9% SLA, dedicated infrastructure, and audit logs.',
  'workspace.activeTier': 'Current Plan',
  'workspace.upgradeBtn': 'Select Plan',
  'workspace.billingSection': 'Payment Gateway Contour',
  'workspace.gatewayGlobal': 'Global: Stripe / Paddle',
  'workspace.gatewayGlobalDesc': 'Automated international billing in USD and EUR via corporate cards and invoices.',
  'workspace.gatewayRu': 'RU: YooKassa / Corporate Wire Invoice',
  'workspace.gatewayRuDesc': 'Settlement in RUB via B2B wire invoice (EDO) or YooKassa payment gateway.',
  'workspace.botConfigTitle': 'Corporate Telegram Bot Username',
  'workspace.botConfigDesc': 'Specify your bot username (without @) to generate employee deep-link invitations.',
  'workspace.exportSection': 'Corporate Registry Export (CSV)',
  'workspace.exportDesc': 'Download workspace registries in UTF-8 CSV format for financial reporting and BI.',
  'workspace.exportDealsCsv': 'Export Deals (CSV)',
  'workspace.exportTasksCsv': 'Export Tasks (CSV)',
  'workspace.exportTeamCsv': 'Export Team (CSV)',

  // Modals (AddRecordModal)
  'modal.newTaskTitle': 'New Corporate Task',
  'modal.newEmployeeTitle': 'Add Team Member',
  'modal.newDealTitle': 'New Commercial Deal',
  'modal.taskTitleLabel': 'Task Objective',
  'modal.taskTitlePlaceholder': 'e.g. Approve engineering specification and delivery schedule',
  'modal.taskDescLabel': 'Description / Working Note',
  'modal.taskDescPlaceholder': 'Additional context for the assignee or department...',
  'modal.taskTypeLabel': 'Record Type',
  'modal.taskPriorityLabel': 'Priority',
  'modal.taskStatusLabel': 'Status',
  'modal.taskAssigneeLabel': 'Assigned Member',
  'modal.taskDepartmentLabel': 'Department / Division',
  'modal.unassignedDeptBroadcast': 'Unassigned (notify selected department)',
  'modal.taskDepartmentHint': 'If no individual assignee is chosen, all Telegram-linked members of the selected department will be notified.',
  'modal.empNameLabel': 'Full Name',
  'modal.empNamePlaceholder': 'e.g. Dmitry Volkov',
  'modal.empRoleLabel': 'Job Title / Position',
  'modal.empRolePlaceholder': 'e.g. Chief Engineer, Economist, Legal Counsel',
  'modal.empDeptLabel': 'Department / Division',
  'modal.empDeptPlaceholder': 'e.g. Finance Department, Engineering, Commercial Block',
  'modal.empAccessLabel': 'Base System Access Level',
  'modal.empEmailLabel': 'Corporate Email',
  'modal.empTgLabel': 'Telegram ID',
  'modal.dealClientLabel': 'Client Organization',
  'modal.dealClientPlaceholder': 'e.g. StroyInvest Holding Corp',
  'modal.dealTitleLabel': 'Contract Subject / Project',
  'modal.dealTitlePlaceholder': 'e.g. Annual Enterprise Platform Deployment',
  'modal.dealAmountLabel': 'Contract Amount',
  'modal.dealStageLabel': 'Pipeline Stage',
  'modal.dealJurisdictionLabel': 'Counterparty Jurisdiction',
  'modal.jurisdictionLabel': 'Counterparty Jurisdiction',
  'modal.jurisdictionRu': 'RU & CIS (INN / KPP)',
  'modal.jurisdictionRU': 'RU & CIS (INN / KPP)',
  'modal.jurisdictionGlobal': 'International (VAT / EIN / Reg. No.)',
  'modal.taxIdRu': 'Counterparty INN (Tax ID)',
  'modal.taxIdRuPlaceholder': '7701234567',
  'modal.regNumRu': 'KPP / OGRN',
  'modal.regNumRuPlaceholder': '770101001 / 1027700123456',
  'modal.taxIdGlobal': 'Tax ID / VAT / EIN',
  'modal.taxIdGlobalPlaceholder': 'DE123456789 / 12-3456789',
  'modal.regNumGlobal': 'Registration No. (CRN)',
  'modal.regNumGlobalPlaceholder': 'HRB 123456 / 09876543',
  'modal.contractNumberLabel': 'Contract / Invoice No. (PO #)',
  'modal.contractNumberPlaceholder': 'e.g. CN-2026/104 or PO-8841',
  'modal.dealAssigneeLabel': 'Responsible Manager',
  'modal.dealDepartmentLabel': 'Assigned Department',
  'modal.dealContactLabel': 'Primary Contact (Phone / Email / Telegram)',
  'modal.dealContactPlaceholder': '+1 (555) 000-0000 / contact@company.com',
  'modal.dealNotesLabel': 'Deal Notes',
  'modal.dealNotesPlaceholder': 'Payment terms, decision maker, target close date...',
  'modal.cancel': 'Cancel',
  'modal.submit': 'Save Record',
  'modal.saving': 'Saving...',

  // Invite Code & Deep-Link Modal
  'invite.modalTitle': 'Employee Invite Code & Telegram Link',
  'invite.modalSubtitle': 'Share this direct link or personal invite code with the employee. Opening the link in Telegram automatically binds their account.',
  'invite.codeLabel': 'Personal Invite Code',
  'invite.deepLinkLabel': 'Direct Telegram Synchronization Link',
  'invite.copyCode': 'Copy Code',
  'invite.copyLink': 'Copy Link',
  'invite.copied': 'Copied',
  'invite.step1': '1. Share the invite code for web login or the direct link for Telegram synchronization.',
  'invite.step2': '2. Pressing Start in the Telegram bot automatically binds the employee Telegram ID.',
  'invite.step3': '3. The bot adapts its interactive menu to the employee permission matrix.',
  'invite.close': 'Close',
  'invite.doneBtn': 'Done',

  // ConfirmDialog
  'confirm.cancel': 'Cancel',
  'confirm.confirm': 'Confirm',
  'confirm.processing': 'Processing...',
  'confirm.deleteTaskTitle': 'Confirm Task Deletion',
  'confirm.deleteTaskDesc': 'This task will be permanently deleted from the organization registry. Please confirm.',
  'confirm.deleteEmployeeTitle': 'Confirm Member Removal',
  'confirm.deleteEmployeeDesc': 'The employee profile, permissions, and Telegram link will be permanently removed.',
  'confirm.deleteDealTitle': 'Confirm Deal Deletion',
  'confirm.deleteDealDesc': 'This commercial deal record will be permanently removed from the CRM registry.',
  'confirm.criticalStatusTitle': 'Confirm Permission or Status Change',
  'confirm.criticalStatusDesc': 'You are modifying a member system access level or moving a deal to a closed stage. Please confirm.',
  'confirm.signOutTitle': 'Sign Out of Workspace',
  'confirm.signOutDesc': 'Are you sure you want to end your current employee session?',

  // Notifications
  'toast.pushSent': 'Notification delivered via Telegram.',
  'toast.messageSent': 'Message posted to workspace stream and sent via Telegram.',
  'toast.deptUpdated': 'Organization department structure updated.',
  'toast.planUpdated': 'Organization subscription plan updated.',
  'toast.gatewayUpdated': 'Billing payment gateway contour saved.',
  'toast.csvExported': 'CSV file generated and downloaded.',
  'toast.permissionsUpdated': 'Employee permission matrix saved.',
  'system.loading': 'Loading TedCloud Enterprise Workspace...',
  'system.connectionError': 'Server Communication Error',
  'system.retry': 'Retry Connection',
  'system.resetCacheBtn': 'Reset Session Cache & Reload',
  'common.generalScope': 'General Workspace',
  'common.unassigned': 'Unassigned',
  'theme.dark': 'Dark Mode',
  'theme.light': 'Light Mode',
};

const dictionaries: Record<SupportedLocale, Dictionary> = { ru, en };

interface LocaleContextValue {
  locale: SupportedLocale;
  language: SupportedLocale;
  currency: SupportedCurrency;
  theme: SupportedTheme;
  setLocale: (loc: SupportedLocale) => void;
  setLanguage: (loc: SupportedLocale) => void;
  setCurrency: (cur: SupportedCurrency) => void;
  setTheme: (next: SupportedTheme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
  formatRole: (val?: string | null) => string;
  formatMoney: (amountInRub: number) => string;
  formatCurrency: (amountInRub: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    try {
      const saved = (localStorage.getItem('tedcloud_locale') || '')
        .toLowerCase()
        .trim() as SupportedLocale;
      return saved === 'en' || saved === 'ru' ? saved : 'ru';
    } catch {
      return 'ru';
    }
  });

  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    try {
      const saved = (localStorage.getItem('tedcloud_currency') || '')
        .toUpperCase()
        .trim() as SupportedCurrency;
      return saved === 'USD' || saved === 'EUR' || saved === 'RUB' ? saved : 'RUB';
    } catch {
      return 'RUB';
    }
  });

  const [theme, setThemeState] = useState<SupportedTheme>(() => {
    try {
      const saved = (localStorage.getItem('tedcloud_theme') || '')
        .toLowerCase()
        .trim() as SupportedTheme;
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      const body = document.body;
      if (theme === 'light') {
        root.classList.add('theme-light');
        root.classList.remove('theme-dark');
        body.classList.add('theme-light');
        body.classList.remove('theme-dark');
        root.style.backgroundColor = '#f8fafc';
        body.style.backgroundColor = '#f8fafc';
      } else {
        root.classList.add('theme-dark');
        root.classList.remove('theme-light');
        body.classList.add('theme-dark');
        body.classList.remove('theme-light');
        root.style.backgroundColor = '#070709';
        body.style.backgroundColor = '#070709';
      }
    } catch {}
  }, [theme]);

  const setLocale = useCallback((next: SupportedLocale | string) => {
    const normalized: SupportedLocale =
      String(next || '').toLowerCase().trim() === 'en' ? 'en' : 'ru';
    setLocaleState(normalized);
    try {
      localStorage.setItem('tedcloud_locale', normalized);
    } catch {}
  }, []);

  const setCurrency = useCallback((next: SupportedCurrency | string) => {
    const upper = String(next || '').toUpperCase().trim();
    const normalized: SupportedCurrency =
      upper === 'USD' || upper === 'EUR' ? upper : 'RUB';
    setCurrencyState(normalized);
    try {
      localStorage.setItem('tedcloud_currency', normalized);
    } catch {}
  }, []);

  const setTheme = useCallback((next: SupportedTheme | string) => {
    const normalized: SupportedTheme =
      String(next || '').toLowerCase().trim() === 'light' ? 'light' : 'dark';
    setThemeState(normalized);
    try {
      localStorage.setItem('tedcloud_theme', normalized);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: SupportedTheme = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('tedcloud_theme', next);
      } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string): string => {
      const resolved = dictionaries[locale]?.[key] || dictionaries.ru[key];
      if (resolved && !resolved.includes('.')) {
        return resolved;
      }
      if (resolved && !key.startsWith('common.')) {
        return resolved;
      }
      if (!resolved || resolved === key || resolved.includes('common.')) {
        return locale === 'en' ? 'General Workspace' : 'Общий контур';
      }
      return resolved;
    },
    [locale]
  );

  const formatRole = useCallback(
    (val?: string | null): string => {
      return formatRoleOrDept(val, locale);
    },
    [locale]
  );

  const formatMoney = useCallback(
    (amountInRub: number): string => {
      const safeRub = Number.isFinite(amountInRub) ? amountInRub : 0;
      const rate = CURRENCY_RATES_FROM_RUB[currency] || 1;
      const converted = safeRub * rate;
      const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US';

      return new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(converted);
    },
    [currency, locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      language: locale,
      currency,
      theme,
      setLocale,
      setLanguage: setLocale,
      setCurrency,
      setTheme,
      toggleTheme,
      t,
      formatRole,
      formatMoney,
      formatCurrency: formatMoney,
    }),
    [locale, currency, theme, setLocale, setCurrency, setTheme, toggleTheme, t, formatRole, formatMoney]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}
