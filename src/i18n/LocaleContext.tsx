import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type SupportedLocale = 'ru' | 'en';
export type SupportedCurrency = 'RUB' | 'USD' | 'EUR';
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
  'nav.team': 'Штат и Доступы',
  'nav.profile': 'Личный кабинет',
  'nav.workspace': 'Организация и Биллинг',

  // TopBar
  'topbar.workspace': 'Организация',
  'topbar.sync': 'Обновить',
  'topbar.language': 'Язык',
  'topbar.currency': 'Валюта',

  // Auth Gate (Экран авторизации и регистрации компании)
  'auth.subtitle': 'Корпоративная система управления задачами, структурой компании и сделками',
  'auth.tabSignIn': 'Вход для сотрудников',
  'auth.tabRegister': 'Регистрация компании',
  'auth.signInTitle': 'Вход в рабочее пространство',
  'auth.signInDesc': 'Введите персональный код приглашения (TC-XXXX), рабочий Email или привязанный Telegram ID.',
  'auth.identifierLabel': 'Инвайт-код, Email или Telegram ID',
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

  // Section Headers (без технических артефактов)
  'header.overviewTitle': 'Дашборд организации',
  'header.overviewSubtitle': 'Ключевые показатели эффективности, конверсия воронки и сводка активных поручений',
  'header.tasksTitle': 'Реестр задач и поручений',
  'header.tasksSubtitle': 'Постановка задач сотрудникам с учетом должностей и уведомлением в Telegram',
  'header.crmTitle': 'Воронка корпоративных сделок',
  'header.crmSubtitle': 'Управление контрактами, стадиями переговоров и финансовым объемом',
  'header.teamTitle': 'Штат сотрудников и Матрица доступов',
  'header.teamSubtitle': 'Свободные должности, подразделения, настройка уровней системного допуска и коды привязки',
  'header.profileTitle': 'Личный кабинет сотрудника',
  'header.profileSubtitle': 'Управление персональными данными, должностью, правами доступа и синхронизацией с Telegram',
  'header.workspaceTitle': 'Организация и Биллинг',
  'header.workspaceSubtitle': 'Профиль компании, тарифный план, платежные реквизиты и выгрузка реестров в CSV',

  // Actions
  'actions.searchPlaceholder': 'Поиск по названию, должности, клиенту...',
  'actions.newTask': 'Создать задачу',
  'actions.newEmployee': 'Добавить сотрудника',
  'actions.newDeal': 'Создать сделку',

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

  // Tasks Section
  'tasks.sectionTitle': 'Корпоративные задачи',
  'tasks.myTasks': 'Мои задачи',
  'tasks.allPriorities': 'Все приоритеты',
  'tasks.addBtn': 'Создать задачу',
  'tasks.emptyTitle': 'Активные задачи отсутствуют',
  'tasks.empty': 'Создайте первую задачу в веб-интерфейсе или отправьте сообщение корпоративному Telegram-боту.',
  'tasks.assignee': 'Исполнитель',
  'tasks.unassigned': 'Не назначен',

  // Priorities & Statuses (Строго на выбранном языке, без дублирования)
  'priority.High': 'Высокий',
  'priority.Medium': 'Средний',
  'priority.Low': 'Низкий',
  'status.Todo': 'К выполнению',
  'status.In Progress': 'В работе',
  'status.Done': 'Выполнено',
  'type.Task': 'Поручение',
  'type.Bug': 'Инцидент',
  'type.Epic': 'Проект',

  // Access Levels (Уровни системного допуска)
  'access.root': 'Полный доступ (Владелец / Администратор)',
  'access.manager': 'Управление подразделением (Координатор)',
  'access.member': 'Базовый доступ (Штатный сотрудник)',
  'access.viewer': 'Гостевой / Аудит (Только чтение)',
  'accessShort.root': 'Полный доступ',
  'accessShort.manager': 'Координатор',
  'accessShort.member': 'Штатный доступ',
  'accessShort.viewer': 'Только чтение',

  // Granular Permissions (Индивидуальные права)
  'perm.title': 'Индивидуальные полномочия в системе',
  'perm.canAssignTasks': 'Постановка задач другим сотрудникам',
  'perm.canManageCrm': 'Доступ к сделкам и финансам CRM',
  'perm.canManageTeam': 'Управление штатом и выдача инвайтов',
  'perm.canDeleteAndSettings': 'Удаление записей и настройки компании',

  // Team Section
  'team.sectionTitle': 'Штатное расписание и уровни допуска',
  'team.addBtn': 'Добавить сотрудника',
  'team.emptyTitle': 'Штат сотрудников не заполнен',
  'team.empty': 'Добавьте сотрудников с указанием их реальной должности, подразделения и уровня системного допуска.',
  'team.colEmployee': 'ФИО и Email',
  'team.colJobTitle': 'Должность и Подразделение',
  'team.colAccess': 'Системный допуск и Права',
  'team.colInviteCode': 'Код приглашения',
  'team.colTelegram': 'Связь с Telegram',
  'team.colActions': 'Действия',
  'team.connected': 'Синхронизирован',
  'team.pendingInvite': 'Ожидает активации',
  'team.inviteLinkBtn': 'Ссылка привязки',
  'team.noDepartment': 'Отдел не указан',

  // CRM Section
  'crm.sectionTitle': 'Реестр коммерческих сделок',
  'crm.addBtn': 'Создать сделку',
  'crm.emptyTitle': 'Воронка сделок пуста',
  'crm.empty': 'Зарегистрируйте первую коммерческую сделку для отслеживания стадий переговоров и выручки.',
  'crm.colClient': 'Клиент и Предмет договора',
  'crm.colContact': 'Контактные данные',
  'crm.colStage': 'Этап воронки',
  'crm.colAmount': 'Сумма контракта',
  'crm.colControl': 'Управление',
  'stage.New': 'Новая',
  'stage.Negotiation': 'Переговоры',
  'stage.Won': 'Выиграна',
  'stage.Lost': 'Закрыта',

  // Profile Tab (Личный кабинет)
  'profile.cardTitle': 'Персональная карточка сотрудника',
  'profile.cardSubtitle': 'Отредактируйте свои контактные данные, должность и подразделение',
  'profile.fullName': 'ФИО сотрудника',
  'profile.jobTitle': 'Должность в компании',
  'profile.department': 'Подразделение / Отдел',
  'profile.email': 'Корпоративный Email',
  'profile.saveBtn': 'Сохранить изменения профиля',
  'profile.savingBtn': 'Сохранение...',
  'profile.savedToast': 'Данные личного профиля успешно обновлены.',
  'profile.securityTitle': 'Уровень допуска и синхронизация Telegram',
  'profile.accessLevelLabel': 'Текущий контур допуска',
  'profile.telegramStatusLabel': 'Статус привязки Telegram-аккаунта',
  'profile.telegramConnectedId': 'Привязан (ID:',
  'profile.telegramNotConnected': 'Не привязан к Telegram-боту',
  'profile.syncLinkLabel': 'Персональная ссылка синхронизации с ботом',
  'profile.sessionTitle': 'Управление сессией',
  'profile.sessionDesc': 'При выходе из учетной записи потребуется повторный ввод инвайт-кода или Email на экране авторизации.',
  'profile.signOutBtn': 'Завершить сессию и выйти',

  // Workspace & Billing Tab
  'workspace.orgSection': 'Профиль организации',
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
  'workspace.exportDesc': 'Выгрузка актуальных таблиц базы данных в кодировке UTF-8 для внешней отчетности.',
  'workspace.exportDealsCsv': 'Выгрузить сделки (CSV)',
  'workspace.exportTasksCsv': 'Выгрузить задачи (CSV)',
  'workspace.exportTeamCsv': 'Выгрузить штат (CSV)',

  // Modals (AddRecordModal)
  'modal.newTaskTitle': 'Создание корпоративной задачи',
  'modal.newEmployeeTitle': 'Добавление сотрудника в штат',
  'modal.newDealTitle': 'Регистрация коммерческой сделки',
  'modal.taskTitleLabel': 'Формулировка задачи',
  'modal.taskTitlePlaceholder': 'Например: Согласовать смету и график поставок',
  'modal.taskTypeLabel': 'Тип записи',
  'modal.taskPriorityLabel': 'Приоритет',
  'modal.taskStatusLabel': 'Статус',
  'modal.taskAssigneeLabel': 'Ответственный исполнитель',
  'modal.empNameLabel': 'ФИО сотрудника',
  'modal.empNamePlaceholder': 'Например: Волков Дмитрий Сергеевич',
  'modal.empRoleLabel': 'Должность / Роль в компании (свободный ввод)',
  'modal.empRolePlaceholder': 'Например: Главный инженер, Финансовый директор, Юрист',
  'modal.empDeptLabel': 'Подразделение / Отдел (свободный ввод)',
  'modal.empDeptPlaceholder': 'Например: ПТО, Коммерческий отдел, Юридический блок',
  'modal.empAccessLabel': 'Базовый уровень системного допуска',
  'modal.empEmailLabel': 'Корпоративный Email',
  'modal.empTgLabel': 'Telegram ID (необязательно при входе по коду)',
  'modal.dealClientLabel': 'Компания / Заказчик',
  'modal.dealClientPlaceholder': 'Например: АО СтройИнвест Холдинг',
  'modal.dealTitleLabel': 'Предмет договора / проект',
  'modal.dealTitlePlaceholder': 'Например: Поставка лицензий и внедрение контура',
  'modal.dealAmountLabel': 'Сумма контракта (в базовой валюте RUB)',
  'modal.dealStageLabel': 'Стадия воронки',
  'modal.dealContactLabel': 'Контактное лицо (Телефон / Email / Telegram)',
  'modal.dealContactPlaceholder': '+7 (495) 000-00-00 / contact@company.ru',
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
  'invite.step3': '3. В сообщении бота сотруднику будут отображены его должность и подразделение.',
  'invite.close': 'Закрыть окно',

  // ConfirmDialog
  'confirm.cancel': 'Отмена',
  'confirm.confirm': 'Подтвердить',
  'confirm.processing': 'Выполнение...',
  'confirm.deleteTaskTitle': 'Подтверждение удаления задачи',
  'confirm.deleteTaskDesc': 'Выбранная задача будет безвозвратно удалена из базы данных организации. Подтвердите действие.',
  'confirm.deleteEmployeeTitle': 'Удаление профиля сотрудника',
  'confirm.deleteEmployeeDesc': 'Профиль сотрудника, его права доступа и привязка Telegram будут удалены из системы.',
  'confirm.deleteDealTitle': 'Удаление карточки сделки',
  'confirm.deleteDealDesc': 'Запись о коммерческой сделке будет безвозвратно удалена из реестра CRM.',
  'confirm.criticalStatusTitle': 'Подтверждение изменения полномочий или статуса',
  'confirm.criticalStatusDesc': 'Вы изменяете уровень системного допуска сотрудника или переводите сделку в закрытый статус. Подтвердите операцию.',
  'confirm.signOutTitle': 'Завершение корпоративной сессии',
  'confirm.signOutDesc': 'Вы действительно хотите выйти из учетной записи сотрудника?',

  // Notifications
  'toast.pushSent': 'Уведомление о задаче отправлено исполнителю в Telegram.',
  'toast.planUpdated': 'Тарифный план организации обновлен.',
  'toast.gatewayUpdated': 'Платежный контур биллинга сохранен.',
  'toast.csvExported': 'Файл CSV сформирован и загружен.',
  'toast.permissionsUpdated': 'Матрица прав доступа сотрудника обновлена.',
  'system.loading': 'Загрузка корпоративного пространства TedCloud...',
  'system.connectionError': 'Ошибка обмена данными с сервером',
  'system.retry': 'Повторить попытку',
};

const en: Dictionary = {
  // Brand & Navigation
  'brand.edition': 'Enterprise',
  'nav.overview': 'Overview',
  'nav.tasks': 'Tasks',
  'nav.crm': 'CRM Deals',
  'nav.team': 'Team & Access',
  'nav.profile': 'My Profile',
  'nav.workspace': 'Workspace & Billing',

  // TopBar
  'topbar.workspace': 'Organization',
  'topbar.sync': 'Refresh',
  'topbar.language': 'Language',
  'topbar.currency': 'Currency',

  // Auth Gate
  'auth.subtitle': 'Enterprise task governance, organizational structure, and B2B CRM platform',
  'auth.tabSignIn': 'Employee Sign In',
  'auth.tabRegister': 'Create Workspace',
  'auth.signInTitle': 'Sign in to your workspace',
  'auth.signInDesc': 'Enter your personal invite code (TC-XXXX), corporate Email, or linked Telegram ID.',
  'auth.identifierLabel': 'Invite Code, Email, or Telegram ID',
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
  'header.overviewSubtitle': 'Key performance metrics, pipeline conversion, and active task summary',
  'header.tasksTitle': 'Corporate Task Registry',
  'header.tasksSubtitle': 'Assign tasks across job titles with instant Telegram notifications',
  'header.crmTitle': 'Commercial Deal Pipeline',
  'header.crmSubtitle': 'Manage B2B contracts, negotiation stages, and financial pipeline volume',
  'header.teamTitle': 'Team Directory & Access Matrix',
  'header.teamSubtitle': 'Custom job titles, departments, system access levels, and onboarding codes',
  'header.profileTitle': 'My Employee Profile',
  'header.profileSubtitle': 'Manage your personal profile, job title, department, and Telegram synchronization',
  'header.workspaceTitle': 'Workspace & Billing',
  'header.workspaceSubtitle': 'Company profile, subscription tier, payment gateway contour, and CSV data export',

  // Actions
  'actions.searchPlaceholder': 'Search by title, position, client...',
  'actions.newTask': 'Create Task',
  'actions.newEmployee': 'Add Member',
  'actions.newDeal': 'Create Deal',

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

  // Tasks Section
  'tasks.sectionTitle': 'Organization Tasks',
  'tasks.myTasks': 'Assigned to Me',
  'tasks.allPriorities': 'All Priorities',
  'tasks.addBtn': 'Create Task',
  'tasks.emptyTitle': 'No tasks registered',
  'tasks.empty': 'Create your first task in the web console or send a message to the corporate Telegram bot.',
  'tasks.assignee': 'Assignee',
  'tasks.unassigned': 'Unassigned',

  // Priorities & Statuses (Strictly single language)
  'priority.High': 'High',
  'priority.Medium': 'Medium',
  'priority.Low': 'Low',
  'status.Todo': 'To Do',
  'status.In Progress': 'In Progress',
  'status.Done': 'Completed',
  'type.Task': 'Task',
  'type.Bug': 'Issue',
  'type.Epic': 'Initiative',

  // Access Levels
  'access.root': 'Full Access (Owner / Administrator)',
  'access.manager': 'Department Management (Coordinator)',
  'access.member': 'Standard Access (Staff Member)',
  'access.viewer': 'Guest / Audit (Read-only)',
  'accessShort.root': 'Full Access',
  'accessShort.manager': 'Coordinator',
  'accessShort.member': 'Staff Member',
  'accessShort.viewer': 'Read-only',

  // Granular Permissions
  'perm.title': 'Granular System Permissions',
  'perm.canAssignTasks': 'Assign tasks to other members',
  'perm.canManageCrm': 'Access CRM deals and financials',
  'perm.canManageTeam': 'Manage staff and issue invites',
  'perm.canDeleteAndSettings': 'Delete records and company settings',

  // Team Section
  'team.sectionTitle': 'Organization Directory & Permissions',
  'team.addBtn': 'Add Member',
  'team.emptyTitle': 'No team members found',
  'team.empty': 'Add employees with their custom job titles, departments, and system access levels.',
  'team.colEmployee': 'Name & Email',
  'team.colJobTitle': 'Job Title & Department',
  'team.colAccess': 'Access Level & Permissions',
  'team.colInviteCode': 'Invite Code',
  'team.colTelegram': 'Telegram Link',
  'team.colActions': 'Actions',
  'team.connected': 'Connected',
  'team.pendingInvite': 'Pending Activation',
  'team.inviteLinkBtn': 'Activation Link',
  'team.noDepartment': 'No department specified',

  // CRM Section
  'crm.sectionTitle': 'Commercial Deal Registry',
  'crm.addBtn': 'Create Deal',
  'crm.emptyTitle': 'No deals in pipeline',
  'crm.empty': 'Register your first commercial deal to track negotiation stages and revenue.',
  'crm.colClient': 'Client & Contract Subject',
  'crm.colContact': 'Contact Details',
  'crm.colStage': 'Stage',
  'crm.colAmount': 'Contract Value',
  'crm.colControl': 'Control',
  'stage.New': 'New',
  'stage.Negotiation': 'Negotiation',
  'stage.Won': 'Won',
  'stage.Lost': 'Lost',

  // Profile Tab
  'profile.cardTitle': 'Employee Profile Card',
  'profile.cardSubtitle': 'Update your full name, job title, department, and corporate email',
  'profile.fullName': 'Full Name',
  'profile.jobTitle': 'Job Title / Position',
  'profile.department': 'Department / Division',
  'profile.email': 'Corporate Email',
  'profile.saveBtn': 'Save Profile Changes',
  'profile.savingBtn': 'Saving...',
  'profile.savedToast': 'Personal profile updated successfully.',
  'profile.securityTitle': 'Access Clearance & Telegram Synchronization',
  'profile.accessLevelLabel': 'System Access Contour',
  'profile.telegramStatusLabel': 'Telegram Account Binding',
  'profile.telegramConnectedId': 'Connected (ID:',
  'profile.telegramNotConnected': 'Not linked to Telegram bot',
  'profile.syncLinkLabel': 'Personal Bot Synchronization Link',
  'profile.sessionTitle': 'Session Control',
  'profile.sessionDesc': 'Signing out will clear your current session and return you to the authentication screen.',
  'profile.signOutBtn': 'Sign Out of Workspace',

  // Workspace & Billing Tab
  'workspace.orgSection': 'Organization Profile',
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
  'workspace.exportDesc': 'Download database registries in UTF-8 CSV format for financial reporting and BI.',
  'workspace.exportDealsCsv': 'Export Deals (CSV)',
  'workspace.exportTasksCsv': 'Export Tasks (CSV)',
  'workspace.exportTeamCsv': 'Export Team (CSV)',

  // Modals (AddRecordModal)
  'modal.newTaskTitle': 'Create Corporate Task',
  'modal.newEmployeeTitle': 'Add Team Member',
  'modal.newDealTitle': 'Create Commercial Deal',
  'modal.taskTitleLabel': 'Task Objective',
  'modal.taskTitlePlaceholder': 'e.g. Approve engineering specification and delivery schedule',
  'modal.taskTypeLabel': 'Record Type',
  'modal.taskPriorityLabel': 'Priority',
  'modal.taskStatusLabel': 'Status',
  'modal.taskAssigneeLabel': 'Assigned Member',
  'modal.empNameLabel': 'Full Name',
  'modal.empNamePlaceholder': 'e.g. Dmitry Volkov',
  'modal.empRoleLabel': 'Job Title / Position (free text input)',
  'modal.empRolePlaceholder': 'e.g. Chief Engineer, CFO, Head of Legal, Senior Developer',
  'modal.empDeptLabel': 'Department / Division (free text input)',
  'modal.empDeptPlaceholder': 'e.g. Engineering, Commercial Division, Legal Block',
  'modal.empAccessLabel': 'System Access Contour',
  'modal.empEmailLabel': 'Corporate Email',
  'modal.empTgLabel': 'Telegram ID (optional when using invite code)',
  'modal.dealClientLabel': 'Client Organization',
  'modal.dealClientPlaceholder': 'e.g. StroyInvest Holding Corp',
  'modal.dealTitleLabel': 'Contract Subject / Project',
  'modal.dealTitlePlaceholder': 'e.g. Annual Enterprise Platform Deployment',
  'modal.dealAmountLabel': 'Contract Value (base in RUB)',
  'modal.dealStageLabel': 'Pipeline Stage',
  'modal.dealContactLabel': 'Primary Contact (Phone / Email / Telegram)',
  'modal.dealContactPlaceholder': '+1 (555) 000-0000 / contact@company.com',
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
  'invite.step3': '3. The bot confirms access and displays the employee job title and department.',
  'invite.close': 'Close',

  // ConfirmDialog
  'confirm.cancel': 'Cancel',
  'confirm.confirm': 'Confirm',
  'confirm.processing': 'Processing...',
  'confirm.deleteTaskTitle': 'Confirm Task Deletion',
  'confirm.deleteTaskDesc': 'This task will be permanently deleted from the organization database. Please confirm.',
  'confirm.deleteEmployeeTitle': 'Confirm Member Removal',
  'confirm.deleteEmployeeDesc': 'The employee profile, permissions, and Telegram link will be permanently removed.',
  'confirm.deleteDealTitle': 'Confirm Deal Deletion',
  'confirm.deleteDealDesc': 'This commercial deal record will be permanently removed from the CRM registry.',
  'confirm.criticalStatusTitle': 'Confirm Permission or Status Change',
  'confirm.criticalStatusDesc': 'You are modifying a member system access level or moving a deal to a closed stage. Please confirm.',
  'confirm.signOutTitle': 'Sign Out of Workspace',
  'confirm.signOutDesc': 'Are you sure you want to end your current employee session?',

  // Notifications
  'toast.pushSent': 'Task notification delivered to the assignee via Telegram.',
  'toast.planUpdated': 'Organization subscription plan updated.',
  'toast.gatewayUpdated': 'Billing payment gateway contour saved.',
  'toast.csvExported': 'CSV file generated and downloaded.',
  'toast.permissionsUpdated': 'Employee permission matrix updated.',
  'system.loading': 'Loading TedCloud Enterprise Workspace...',
  'system.connectionError': 'Server Communication Error',
  'system.retry': 'Retry Connection',
};

const dictionaries: Record<SupportedLocale, Dictionary> = { ru, en };

interface LocaleContextValue {
  locale: SupportedLocale;
  language: SupportedLocale;
  currency: SupportedCurrency;
  setLocale: (loc: SupportedLocale) => void;
  setLanguage: (loc: SupportedLocale) => void;
  setCurrency: (cur: SupportedCurrency) => void;
  t: (key: string) => string;
  formatMoney: (amountInRub: number) => string;
  formatCurrency: (amountInRub: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    try {
      const saved = localStorage.getItem('tedcloud_locale') as SupportedLocale | null;
      return saved === 'en' || saved === 'ru' ? saved : 'ru';
    } catch {
      return 'ru';
    }
  });

  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    try {
      const saved = localStorage.getItem('tedcloud_currency') as SupportedCurrency | null;
      return saved === 'USD' || saved === 'EUR' || saved === 'RUB' ? saved : 'RUB';
    } catch {
      return 'RUB';
    }
  });

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem('tedcloud_locale', next);
    } catch {}
  }, []);

  const setCurrency = useCallback((next: SupportedCurrency) => {
    setCurrencyState(next);
    try {
      localStorage.setItem('tedcloud_currency', next);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string): string => {
      return dictionaries[locale][key] || dictionaries.ru[key] || key;
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
      setLocale,
      setLanguage: setLocale,
      setCurrency,
      t,
      formatMoney,
      formatCurrency: formatMoney,
    }),
    [locale, currency, setLocale, setCurrency, t, formatMoney]
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
