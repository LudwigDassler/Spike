import React, { useState } from 'react';
import {
  Building2,
  KeyRound,
  Loader2,
  AlertCircle,
  Globe,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Company, OrganizationNode } from '../types/database';
import { useLocale, SupportedLocale } from '../i18n/LocaleContext';

interface AuthGateProps {
  existingNodes: OrganizationNode[];
  existingCompany: Company | null;
  onAuthenticated: (profile: OrganizationNode, company: Company | null) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  existingNodes,
  existingCompany,
  onAuthenticated,
}) => {
  const { locale, setLocale, t } = useLocale();
  const [mode, setMode] = useState<'signin' | 'register'>(
    existingNodes.length === 0 ? 'register' : 'signin'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sign-In state
  const [input, setInput] = useState('');

  // Create Workspace state
  const [companyName, setCompanyName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderTitle, setLeaderTitle] = useState('');
  const [leaderDepartment, setLeaderDepartment] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');

  const locales: SupportedLocale[] = ['ru', 'en'];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const q = input.trim().toLowerCase();
    if (!q) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const nodes: OrganizationNode[] = Array.isArray(payload.nodes)
        ? payload.nodes
        : existingNodes;

      const matchedNode = nodes.find(
        (node) =>
          String(node.telegram_chat_id || '').trim().toLowerCase() === q ||
          String(node.invite_code || '').trim().toLowerCase() === q ||
          String(node.email || '').trim().toLowerCase() === q ||
          String(node.name || '').trim().toLowerCase() === q
      );

      if (!matchedNode) {
        setErrorMessage(t('auth.userNotFound'));
        return;
      }

      onAuthenticated(matchedNode, payload.company || existingCompany);
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyName.trim() || !leaderName.trim() || !leaderTitle.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_workspace',
          companyName: companyName.trim(),
          leaderName: leaderName.trim(),
          leaderTitle: leaderTitle.trim(),
          leaderDepartment: leaderDepartment.trim() || null,
          leaderEmail: leaderEmail.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error || !result.profile) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      onAuthenticated(result.profile, result.company || null);
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#EDEDED] font-sans antialiased flex flex-col justify-between p-6">
      {/* Top Bar with Brand & Language Switcher */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs tracking-tight">
            TC
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">TedCloud</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] border border-[#27272A] whitespace-nowrap">
            {t('brand.edition')}
          </span>
        </div>

        <div className="inline-flex items-center rounded-lg border border-[#262626] bg-[#141414] p-0.5">
          <Globe className="w-3.5 h-3.5 text-[#71717A] ml-2 mr-1" />
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                locale === loc ? 'bg-white text-black' : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="my-auto py-8 w-full max-w-md mx-auto">
        <div className="rounded-xl border border-[#262626] bg-[#121214] shadow-2xl overflow-hidden">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 border-b border-[#262626] bg-[#0D0D0F]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              className={`py-3.5 px-4 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border-b-2 ${
                mode === 'signin'
                  ? 'border-white text-white bg-[#141417]'
                  : 'border-transparent text-[#8E8E93] hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{t('auth.tabSignIn')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`py-3.5 px-4 text-xs font-semibold transition-colors flex items-center justify-center gap-2 border-b-2 ${
                mode === 'register'
                  ? 'border-white text-white bg-[#141417]'
                  : 'border-transparent text-[#8E8E93] hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{t('auth.tabRegister')}</span>
            </button>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    {t('auth.signInTitle')}
                  </h1>
                  <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                    {t('auth.signInDesc')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('auth.identifierLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('auth.identifierPlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2.5 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('auth.signingIn')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('auth.signInBtn')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    {t('auth.registerTitle')}
                  </h1>
                  <p className="text-xs text-[#8E8E93] mt-1 leading-relaxed">
                    {t('auth.registerDesc')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('auth.companyNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('auth.companyNamePlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('auth.leaderNameLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder={t('auth.leaderNamePlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('auth.leaderTitleLabel')}
                    </label>
                    <input
                      type="text"
                      required
                      value={leaderTitle}
                      onChange={(e) => setLeaderTitle(e.target.value)}
                      placeholder={t('auth.leaderTitlePlaceholder')}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                      {t('auth.leaderDeptLabel')}
                    </label>
                    <input
                      type="text"
                      value={leaderDepartment}
                      onChange={(e) => setLeaderDepartment(e.target.value)}
                      placeholder={t('auth.leaderDeptPlaceholder')}
                      className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    {t('auth.leaderEmailLabel')}
                  </label>
                  <input
                    type="email"
                    required
                    value={leaderEmail}
                    onChange={(e) => setLeaderEmail(e.target.value)}
                    placeholder={t('auth.leaderEmailPlaceholder')}
                    className="w-full rounded-lg border border-[#262626] bg-[#17171A] px-3.5 py-2 text-sm text-white placeholder-[#52525B] focus:border-[#52525B] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('auth.registering')}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t('auth.registerBtn')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-5xl w-full mx-auto text-center text-[11px] text-[#71717A]">
        TedCloud Enterprise Platform — {t('auth.subtitle')}
      </footer>
    </div>
  );
};
