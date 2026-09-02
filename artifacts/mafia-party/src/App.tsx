import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  BookOpen, Check, ChevronLeft, CircleHelp, Crosshair, Crown, Eye,
  Gavel, HeartPulse, LockKeyhole, Moon, Plus, RotateCcw, Shield,
  Skull, Sparkles, Sun, Swords, Trash2, UserRound, Users, Vote, X,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

type Team = 'المافيا' | 'المدينة' | 'مستقل';
type RoleKey = 'mafia' | 'godfather' | 'mafioso' | 'doctor' | 'detective' | 'bodyguard' | 'mayor' | 'witch' | 'vigilante' | 'jester' | 'cupid' | 'silencer' | 'civilian' | 'survivor';
type Phase = 'setup' | 'reveal' | 'night' | 'day' | 'voting' | 'result';
type Player = { id: string; name: string; role: RoleKey; alive: boolean; silenced?: boolean };
type NightAction = { actorId: string; role: RoleKey; targetId?: string; skipped?: boolean };
type Game = { players: Player[]; phase: Phase; round: number; revealIndex: number; revealed: boolean; nightActions: NightAction[]; dayReport: string[]; votes: Record<string, string>; winner?: Team; lastNightInfo?: string; jesterWon?: boolean };

const queryClient = new QueryClient();
const STORAGE_KEY = 'mafia-party-game-v1';

const ROLES: Record<RoleKey, { name: string; team: Team; description: string; icon: typeof Shield; color: string }> = {
  mafia: { name: 'مافيا', team: 'المافيا', description: 'يختار ضحية كل ليلة مع فريق المافيا.', icon: Skull, color: 'rose' },
  godfather: { name: 'العرّاب', team: 'المافيا', description: 'قائد المافيا، يظهر بريئاً أمام المحقق.', icon: Crown, color: 'rose' },
  mafioso: { name: 'مافيوسو', team: 'المافيا', description: 'ذراع المافيا المنفّذ والوفي.', icon: Swords, color: 'rose' },
  doctor: { name: 'الطبيب', team: 'المدينة', description: 'ينقذ لاعباً واحداً كل ليلة من الموت.', icon: HeartPulse, color: 'emerald' },
  detective: { name: 'المحقق', team: 'المدينة', description: 'يتحقق من هوية لاعب واحد كل ليلة.', icon: Eye, color: 'sky' },
  bodyguard: { name: 'الحارس', team: 'المدينة', description: 'يحمي لاعباً من الخطر، وقد يدفع الثمن بدلاً عنه.', icon: Shield, color: 'sky' },
  mayor: { name: 'العمدة', team: 'المدينة', description: 'صوته يحسم التعادل في التصويت.', icon: Gavel, color: 'amber' },
  witch: { name: 'الساحرة', team: 'المدينة', description: 'تستطيع تعطيل لاعب أو إنقاذ ضحية مرة واحدة.', icon: Sparkles, color: 'violet' },
  vigilante: { name: 'المنتقم', team: 'المدينة', description: 'يملك رصاصة واحدة لمواجهة الخطر ليلاً.', icon: Crosshair, color: 'amber' },
  jester: { name: 'المهرّج', team: 'مستقل', description: 'يفوز وحده إن طُرد بالتصويت.', icon: Sparkles, color: 'fuchsia' },
  cupid: { name: 'كيوبيد', team: 'مستقل', description: 'يربط لاعبين في بداية اللعبة؛ إذا مات أحدهما يتأثر الآخر.', icon: HeartPulse, color: 'pink' },
  silencer: { name: 'المُسكت', team: 'المافيا', description: 'يمنع لاعباً من الكلام في نقاش الغد.', icon: LockKeyhole, color: 'rose' },
  civilian: { name: 'مواطن', team: 'المدينة', description: 'لا يملك قدرة خاصة؛ قوته في الملاحظة والتصويت.', icon: Users, color: 'slate' },
  survivor: { name: 'الناجي', team: 'مستقل', description: 'يفوز إن بقي حياً حتى نهاية اللعبة.', icon: Shield, color: 'teal' },
};

const PRESETS: Record<string, { label: string; description: string; roles: Partial<Record<RoleKey, number>> }> = {
  balanced: { label: 'متوازن', description: 'أفضل بداية لمعظم المجموعات', roles: { mafia: 1, doctor: 1, detective: 1, civilian: 2 } },
  classic: { label: 'كلاسيكي', description: 'ليل هادئ، قرارات حادة', roles: { mafia: 1, doctor: 1, detective: 1, civilian: 3 } },
  chaos: { label: 'ليلة الفوضى', description: 'قدرات أكثر، لا أحد في مأمن', roles: { mafia: 2, doctor: 1, detective: 1, vigilante: 1, jester: 1, civilian: 3 } },
};

function makeBalancedRoles(count: number, preset = 'balanced') {
  const roles: RoleKey[] = [];
  const add = (role: RoleKey) => {
    if (roles.length < count) roles.push(role);
  };
  const mafiaCount = count >= 12 ? 3 : count >= 8 ? 2 : 1;
  Array.from({ length: mafiaCount }).forEach(() => add('mafia'));
  if (count >= 5) add('doctor');
  if (count >= 6) add('detective');
  if (preset === 'chaos') {
    if (count >= 7) add('vigilante');
    if (count >= 10) add('jester');
    if (count >= 13) add('silencer');
    if (count >= 18) add('witch');
  }
  while (roles.length < count) add('civilian');
  return roles.reduce<Partial<Record<RoleKey, number>>>((result, role) => {
    result[role] = (result[role] || 0) + 1;
    return result;
  }, {});
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function saveGame(game: Game | null) { if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); else localStorage.removeItem(STORAGE_KEY); }
function getTeam(role: RoleKey) { return ROLES[role].team; }

function AppShell({ children }: { children: React.ReactNode }) {
  return <div dir="rtl" className="relative min-h-[100dvh] overflow-x-hidden"><div className="app-noise" />{children}</div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? '' : 'justify-center'}`}>
    <div className="relative flex size-11 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-300 shadow-[0_8px_30px_rgba(238,190,75,.13)]">
      <Moon size={22} strokeWidth={1.8} /><span className="absolute -bottom-1 -left-1 size-2 rounded-full bg-rose-400" />
    </div>
    <div><div className="font-serif text-xl font-semibold tracking-tight text-stone-50">مافيا</div><div className="text-[10px] font-medium tracking-[.22em] text-amber-300/60">ليلة واحدة • أسرار كثيرة</div></div>
  </div>;
}

function Button({ children, onClick, variant = 'primary', disabled = false, className = '', type = 'button', testId }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit'; testId?: string }) {
  const styles = {
    primary: 'bg-amber-300 text-[#1b182d] shadow-[0_8px_25px_rgba(238,190,75,.18)] hover:bg-amber-200',
    secondary: 'border border-white/10 bg-white/[.07] text-stone-100 hover:bg-white/[.12]',
    ghost: 'text-stone-300 hover:bg-white/[.08] hover:text-white',
    danger: 'border border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20',
  };
  return <button type={type} data-testid={testId} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 active:translate-y-px ${styles[variant]} ${className}`}>{children}</button>;
}

function Progress({ phase }: { phase: Phase }) {
  const phases: { key: Phase; label: string }[] = [{ key: 'setup', label: 'التجهيز' }, { key: 'reveal', label: 'الكشف' }, { key: 'night', label: 'الليل' }, { key: 'day', label: 'النهار' }, { key: 'voting', label: 'التصويت' }];
  const index = Math.max(0, phases.findIndex((p) => p.key === phase));
  return <div className="mx-auto flex max-w-2xl items-center justify-between gap-1 px-1">
    {phases.map((p, i) => <div key={p.key} className="flex flex-1 items-center gap-1.5">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${i <= index ? 'border-amber-300 bg-amber-300 text-[#1b182d]' : 'border-white/15 text-stone-500'}`}>{i < index ? <Check size={14} /> : i + 1}</div>
      <span className={`hidden text-[11px] sm:block ${i <= index ? 'text-stone-200' : 'text-stone-600'}`}>{p.label}</span>
      {i < phases.length - 1 && <div className={`h-px flex-1 ${i < index ? 'bg-amber-300/70' : 'bg-white/10'}`} />}
    </div>)}
  </div>;
}

function Setup({ onStart, savedGame, onResume, onReset }: { onStart: (names: string[], roles: Partial<Record<RoleKey, number>>) => void; savedGame: Game | null; onResume: () => void; onReset: () => void }) {
  const [namesText, setNamesText] = useState('ليان\nعمر\nنور\nياسر\nهند\nسامي');
  const [preset, setPreset] = useState('balanced');
  const [custom, setCustom] = useState(false);
  const [roleCounts, setRoleCounts] = useState<Partial<Record<RoleKey, number>>>(makeBalancedRoles(6));
  const [help, setHelp] = useState(false);
  const names = namesText.split('\n').map((name) => name.trim()).filter(Boolean);
  useEffect(() => { if (!custom) setRoleCounts(makeBalancedRoles(names.length || 6, preset)); }, [names.length, custom, preset]);
  const roleTotal = Object.values(roleCounts).reduce((a, b) => a + (b || 0), 0);
  const hasDuplicates = new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length;
  const canStart = names.length >= 5 && names.length <= 50 && !hasDuplicates && roleTotal === names.length;
  const updateCount = (role: RoleKey, value: number) => setRoleCounts((current) => ({ ...current, [role]: Math.max(0, Math.min(20, value)) }));
  const changePreset = (value: string) => { setPreset(value); setCustom(false); setRoleCounts(makeBalancedRoles(names.length || 6, value)); };
  return <main className="screen-enter mx-auto min-h-[100dvh] max-w-7xl px-4 py-6 sm:px-8 lg:px-12">
    <header className="flex items-center justify-between"><Brand compact /><button data-testid="button-help" onClick={() => setHelp(true)} className="flex size-11 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/10 hover:text-amber-200"><CircleHelp size={20} /></button></header>
    <div className="mx-auto mt-10 max-w-5xl">
      <div className="mb-9 max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[.07] px-3 py-1.5 text-xs text-amber-200"><Sparkles size={13} /> جهّزوا المسرح</div>
        <h1 className="font-serif text-4xl font-semibold leading-[1.25] tracking-tight text-stone-50 sm:text-6xl">كل شخص هنا<br /><span className="text-amber-300">يخفي شيئاً.</span></h1>
        <p className="mt-4 max-w-md text-base leading-8 text-stone-400">مرّروا الهاتف. لا تنظروا إلى الشاشة إلا عندما يحين دوركم. الليلة، الحقيقة لا تظهر دفعة واحدة.</p>
      </div>
      {savedGame && savedGame.phase !== 'result' && <div className="rise-in mb-5 flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[.07] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300"><RotateCcw size={18} /></div><div><div className="font-semibold text-stone-100">لديكم لعبة لم تنتهِ</div><div className="text-xs text-stone-400">الجولة {savedGame.round} • {savedGame.players.filter((p) => p.alive).length} لاعباً على قيد اللعب</div></div></div><div className="flex gap-2"><Button onClick={onResume} className="min-h-10 px-4 text-xs" testId="button-resume">استئناف اللعبة</Button><Button onClick={onReset} variant="ghost" className="min-h-10 px-3 text-xs" testId="button-discard">لعبة جديدة</Button></div></div>}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[.045] p-5 shadow-2xl shadow-black/10 sm:p-7">
          <div className="mb-5 flex items-end justify-between"><div><div className="mb-1 text-xs font-semibold tracking-wider text-amber-300/80">الخطوة ١</div><h2 className="font-serif text-2xl font-semibold text-stone-100">من في الغرفة؟</h2></div><span data-testid="text-player-count" className={`rounded-full px-3 py-1 text-xs ${names.length >= 5 && names.length <= 50 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{names.length} / 50</span></div>
          <textarea data-testid="input-player-names" value={namesText} onChange={(e) => setNamesText(e.target.value)} placeholder="اكتبوا اسماً في كل سطر..." rows={8} className="w-full resize-none rounded-2xl border border-white/10 bg-[#161429] p-4 text-base leading-8 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/10" />
          <div className="mt-3 flex items-center justify-between text-xs text-stone-500"><span>{hasDuplicates ? 'كل اسم يجب أن يكون مختلفاً' : 'الحد الأدنى ٥ لاعبين'}</span><span>{names.length < 5 ? `أضف ${5 - names.length} أسماء أخرى` : hasDuplicates ? 'هناك أسماء مكررة' : 'الأسماء جاهزة'}</span></div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7">
          <div className="mb-5"><div className="mb-1 text-xs font-semibold tracking-wider text-amber-300/80">الخطوة ٢</div><h2 className="font-serif text-2xl font-semibold text-stone-100">اختاروا نكهة الليلة</h2></div>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">{Object.entries(PRESETS).map(([key, value]) => <button data-testid={`button-preset-${key}`} key={key} onClick={() => changePreset(key)} className={`group rounded-2xl border p-4 text-right transition ${preset === key && !custom ? 'border-amber-300/70 bg-amber-300/[.1]' : 'border-white/10 bg-black/10 hover:border-white/25'}`}><div className="flex items-center justify-between"><span className={`font-semibold ${preset === key && !custom ? 'text-amber-200' : 'text-stone-200'}`}>{value.label}</span>{preset === key && !custom && <Check size={16} className="text-amber-300" />}</div><p className="mt-1 text-xs text-stone-500">{value.description}</p></button>)}</div>
          <button data-testid="button-toggle-custom" onClick={() => setCustom(!custom)} className={`mt-3 flex w-full items-center justify-between rounded-2xl border p-4 text-right transition ${custom ? 'border-amber-300/50 bg-amber-300/[.08]' : 'border-dashed border-white/15 hover:bg-white/[.05]'}`}><span><span className="block font-semibold text-stone-200">تخصيص الأدوار</span><span className="block text-xs text-stone-500">اصنعوا توازناً خاصاً بكم</span></span>{custom ? <Check size={18} className="text-amber-300" /> : <Plus size={18} className="text-stone-500" />}</button>
        </section>
      </div>
      {custom && <section className="rise-in mt-5 rounded-3xl border border-amber-300/20 bg-[#211d39] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-serif text-xl font-semibold text-stone-100">توزيع الأدوار</h2><p className="mt-1 text-xs text-stone-500">يجب أن يساوي مجموع الأدوار عدد اللاعبين تماماً</p></div><span data-testid="text-role-total" className={`rounded-full px-3 py-1 text-xs ${roleTotal === names.length ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{roleTotal} / {names.length}</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{Object.entries(ROLES).map(([key, role]) => { const Icon = role.icon; return <label key={key} className="rounded-xl border border-white/8 bg-black/10 p-3"><span className="flex items-center gap-1.5 text-xs text-stone-300"><Icon size={13} className="text-amber-300" />{role.name}</span><input data-testid={`input-role-${key}`} type="number" min="0" max="20" value={roleCounts[key as RoleKey] || 0} onChange={(e) => updateCount(key as RoleKey, Number(e.target.value))} className="mt-2 w-full border-b border-white/15 bg-transparent py-1 text-lg font-semibold text-stone-100 outline-none focus:border-amber-300" /></label>; })}</div></section>}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><button data-testid="button-open-role-guide" onClick={() => setHelp(true)} className="order-2 inline-flex items-center justify-center gap-2 text-sm text-stone-400 transition hover:text-amber-200 sm:order-1"><BookOpen size={16} /> دليل الأدوار والفرق</button><Button onClick={() => onStart(names, roleCounts)} disabled={!canStart} className="order-1 min-h-14 px-8 text-base sm:order-2" testId="button-start-game">وزّعوا الأدوار <ChevronLeft size={18} /></Button></div>
    </div>
    {help && <RoleGuide onClose={() => setHelp(false)} />}
  </main>;
}

function RoleGuide({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#090812]/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#211d39] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="mb-6 flex items-center justify-between"><div><div className="text-xs font-semibold tracking-wider text-amber-300/80">دليل اللعبة</div><h2 className="mt-1 font-serif text-2xl font-semibold text-stone-100">الأدوار تحت ضوء القمر</h2></div><button data-testid="button-close-role-guide" onClick={onClose} className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-stone-400 hover:text-white"><X size={19} /></button></div><div className="grid gap-2 sm:grid-cols-2">{Object.entries(ROLES).map(([key, role]) => { const Icon = role.icon; return <div data-testid={`card-role-${key}`} key={key} className="flex gap-3 rounded-2xl border border-white/8 bg-black/10 p-3.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Icon size={17} /></div><div><div className="flex items-center gap-2 font-semibold text-stone-200">{role.name}<span className={`rounded-full px-2 py-0.5 text-[10px] ${role.team === 'المافيا' ? 'bg-rose-400/10 text-rose-300' : role.team === 'المدينة' ? 'bg-sky-400/10 text-sky-300' : 'bg-violet-400/10 text-violet-300'}`}>{role.team}</span></div><p className="mt-1 text-xs leading-5 text-stone-500">{role.description}</p></div></div>; })}</div></div></div>;
}

function Reveal({ game, onReveal, onNext }: { game: Game; onReveal: () => void; onNext: () => void }) {
  const player = game.players[game.revealIndex];
  const role = ROLES[player.role];
  const Icon = role.icon;
  return <GameFrame game={game}><div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center text-center"><div className="mb-5 flex items-center gap-2 text-xs text-stone-500"><LockKeyhole size={15} className="text-amber-300" /> الكشف خاص — مرّروا الهاتف بعد الإخفاء</div><div className="mb-5 text-sm text-stone-400">اللاعب {game.revealIndex + 1} من {game.players.length}</div>{!game.revealed ? <><div className="mb-8 flex size-28 items-center justify-center rounded-[2rem] border border-amber-300/25 bg-amber-300/[.08] text-amber-300 pulse-ring"><Eye size={42} strokeWidth={1.3} /></div><h1 className="font-serif text-3xl font-semibold text-stone-100">هل أنت <span className="text-amber-300">{player.name}</span>؟</h1><p className="mt-3 max-w-xs text-sm leading-7 text-stone-500">تأكد أن الجميع لا ينظر. اضغط عندما تكون مستعداً لرؤية دورك.</p><Button onClick={onReveal} className="mt-8 min-h-14 w-full max-w-xs text-base" testId={`button-reveal-${player.id}`}>أنا {player.name}، أريد كشف دوري <Eye size={18} /></Button></> : <div className="rise-in w-full"><div className={`mx-auto mb-6 flex size-28 items-center justify-center rounded-[2rem] border border-amber-300/40 bg-amber-300/10 text-amber-300`}><Icon size={48} strokeWidth={1.4} /></div><div className="text-sm text-stone-400">دورك في هذه الليلة</div><h1 data-testid={`text-role-reveal-${player.id}`} className="mt-2 font-serif text-5xl font-semibold text-amber-300">{role.name}</h1><div className="mx-auto mt-4 inline-flex rounded-full bg-white/8 px-3 py-1 text-xs text-stone-300">{role.team}</div><p className="mx-auto mt-5 max-w-xs text-sm leading-7 text-stone-400">{role.description}</p><div className="mx-auto mt-7 max-w-xs rounded-xl border border-rose-300/15 bg-rose-300/[.05] p-3 text-xs leading-6 text-rose-100/70">احفظ دورك جيداً. لا تكشفه لأحد، ثم أخفِ الشاشة قبل تمرير الهاتف.</div><Button onClick={onNext} className="mt-6 min-h-14 w-full max-w-xs" testId={`button-hide-role-${player.id}`}>{game.revealIndex === game.players.length - 1 ? 'ابدأ الليل الأول' : 'أخفي دوري ومرّر الهاتف'} <ChevronLeft size={18} /></Button></div>}</div></GameFrame>;
}

function GameFrame({ game, children }: { game: Game; children: React.ReactNode }) {
  return <main className="screen-enter min-h-[100dvh] px-4 py-5 sm:px-8"><header className="mx-auto mb-7 flex max-w-5xl items-center justify-between"><Brand compact /><div className="text-left"><div className="text-[10px] tracking-wider text-stone-600">الجولة</div><div data-testid="text-round" className="font-serif text-lg text-amber-300">{game.round}</div></div></header><div className="mx-auto mb-8 max-w-5xl"><Progress phase={game.phase} /></div>{children}</main>;
}

function Night({ game, onAction, onFinish }: { game: Game; onAction: (actorId: string, targetId?: string) => void; onFinish: () => void }) {
  const [privateNotice, setPrivateNotice] = useState<string | null>(null);
  const active = game.players.filter((p) => p.alive && ['mafia', 'godfather', 'mafioso', 'doctor', 'detective', 'bodyguard', 'witch', 'vigilante', 'silencer'].includes(p.role));
  const actionMap = new Map(game.nightActions.map((action) => [action.actorId, action]));
  const actor = active.find((p) => !actionMap.has(p.id));
  const lastAction = game.nightActions[game.nightActions.length - 1];
  const finished = !actor;
  const targetable = game.players.filter((p) => p.alive && (actor?.role !== p.role || actor?.role === 'doctor'));
  const role = actor ? ROLES[actor.role] : null;
  const Icon = role?.icon || Moon;
  const submitAction = (targetId?: string) => {
    if (!actor) return;
    const target = targetId ? game.players.find((player) => player.id === targetId) : undefined;
    onAction(actor.id, targetId);
    if (actor.role === 'detective' && target) {
      const isMafia = target.role !== 'godfather' && getTeam(target.role) === 'المافيا';
      setPrivateNotice(`نتيجة التحقيق: ${target.name} ${isMafia ? 'من المافيا.' : 'ليس من المافيا.'}`);
    } else {
      setPrivateNotice('تم تسجيل الفعل السري. أخفِ الشاشة ومرّروا الهاتف.');
    }
  };
  return <GameFrame game={game}><div className="mx-auto max-w-3xl"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-300/10 text-indigo-200"><Moon size={27} /></div><div className="text-xs font-semibold tracking-[.25em] text-indigo-200/70">الليل {game.round}</div><h1 className="mt-2 font-serif text-3xl font-semibold text-stone-100">{finished ? 'نامت المدينة' : 'المدينة نائمة…'}</h1><p className="mt-2 text-sm text-stone-500">{finished ? 'تمت كل الأفعال السرية. حان وقت معرفة ما حدث.' : 'الأدوار الخاصة فقط ترى هذه الشاشة الآن.'}</p></div>{privateNotice ? <div className="rise-in rounded-3xl border border-amber-300/25 bg-amber-300/[.07] p-7 text-center sm:p-10"><div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300"><LockKeyhole size={30} /></div><div className="text-xs tracking-wider text-amber-200/70">معلومة خاصة</div><h2 data-testid="text-private-night-result" className="mt-3 font-serif text-2xl font-semibold text-stone-100">{privateNotice}</h2><p className="mt-3 text-sm leading-7 text-stone-500">احفظها جيداً، ثم أخفِ الشاشة قبل تمرير الهاتف.</p><Button onClick={() => setPrivateNotice(null)} className="mt-7 min-h-14 w-full sm:w-auto" testId="button-hide-night-result">أخفي النتيجة</Button></div> : finished ? <div className="rise-in rounded-3xl border border-indigo-200/15 bg-indigo-300/[.06] p-6 text-center sm:p-10"><div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-indigo-300/10 text-indigo-200"><Check size={30} /></div><h2 className="font-serif text-2xl font-semibold text-stone-100">كل الأسرار قيلت</h2><p className="mt-2 text-sm text-stone-400">اضغطوا للانتقال إلى ضوء النهار.</p><Button onClick={onFinish} className="mt-7 min-h-14 w-full sm:w-auto" testId="button-finish-night">أعلنوا الصباح <Sun size={18} /></Button></div> : <div className="rise-in rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><div className="mb-6 flex items-center gap-3 border-b border-white/8 pb-5"><div className="flex size-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Icon size={21} /></div><div><div className="text-xs text-stone-500">الفعل السري التالي</div><div data-testid={`text-night-actor-${actor.id}`} className="font-semibold text-stone-100">{actor.name} <span className="font-normal text-stone-500">({role?.name})</span></div></div></div><p className="mb-4 text-sm text-stone-300">{role?.description}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{targetable.map((target) => <button data-testid={`button-target-${target.id}`} key={target.id} onClick={() => submitAction(target.id)} className="flex min-h-14 items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 text-right text-sm text-stone-200 transition hover:border-amber-300/45 hover:bg-amber-300/[.08]"><span className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-xs text-stone-400">{target.name.slice(0, 1)}</span>{target.name}</button>)}</div><button data-testid={`button-skip-action-${actor.id}`} onClick={() => submitAction()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-stone-500 hover:text-stone-300">لا أستخدم القدرة الليلة <ChevronLeft size={14} /></button></div>}{lastAction && !finished && !privateNotice && <p className="mt-4 text-center text-xs text-stone-600">تم تسجيل فعل سري. الهاتف ينتظر دوره التالي.</p>}</div></GameFrame>;
}

function Day({ game, onVoteStart, onNewNight }: { game: Game; onVoteStart: () => void; onNewNight: () => void }) {
  const eliminated = game.dayReport;
  return <GameFrame game={game}><div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300"><Sun size={27} /></div><div className="text-xs font-semibold tracking-[.25em] text-amber-300/70">صباح اليوم {game.round}</div><h1 className="mt-2 font-serif text-4xl font-semibold text-stone-100">من بقي واقفاً؟</h1><p className="mt-2 text-sm text-stone-500">تكلموا. استمعوا. لا تثقوا بالصمت.</p></div>{game.lastNightInfo ? <div className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/[.06] p-6 text-center"><Gavel className="mx-auto mb-3 text-amber-300" size={28} /><div className="font-serif text-xl text-amber-100">{game.lastNightInfo}</div><div className="mt-2 text-xs text-stone-500">صوت العمدة يحسم التعادل إن اختار أحد المتعادلين.</div></div> : eliminated.length ? <div className="mb-5 rounded-3xl border border-rose-300/20 bg-rose-300/[.06] p-6 text-center"><Skull className="mx-auto mb-3 text-rose-300" size={28} /><div className="text-xs text-rose-200/60">ما تركه الليل وراءه</div><div data-testid="text-night-report" className="mt-2 font-serif text-2xl text-rose-200">{eliminated.join('، ')}</div><div className="mt-2 text-xs text-stone-500">لا أحد يعرف الدور. إلا صاحبه.</div></div> : <div className="mb-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.06] p-6 text-center"><Shield className="mx-auto mb-3 text-emerald-300" size={28} /><div className="font-serif text-xl text-emerald-200">مرّت الليلة بلا ضحية</div><div className="mt-2 text-xs text-stone-500">لكن الخطر لم ينتهِ.</div></div>}<div className="rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-stone-100">اللاعبون الأحياء</h2><span className="text-xs text-stone-500">{game.players.filter((p) => p.alive).length} لاعباً</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{game.players.map((p) => <div data-testid={`status-player-${p.id}`} key={p.id} className={`flex items-center gap-2 rounded-xl border p-3 ${p.alive ? 'border-white/8 bg-black/10' : 'border-rose-300/10 bg-rose-300/[.03] opacity-50'}`}><div className={`flex size-8 items-center justify-center rounded-lg text-xs ${p.alive ? 'bg-amber-300/10 text-amber-200' : 'bg-rose-300/10 text-rose-300'}`}>{p.alive ? <UserRound size={15} /> : <Skull size={14} />}</div><span className={`truncate text-sm ${p.alive ? 'text-stone-200' : 'text-stone-500 line-through'}`}>{p.name}</span>{p.alive && p.silenced && <span className="text-[10px] text-violet-200">مُسكت</span>}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button onClick={onVoteStart} className="flex-1" testId="button-start-voting">ابدأوا النقاش والتصويت <Vote size={18} /></Button><Button onClick={onNewNight} variant="secondary" className="sm:w-auto" testId="button-skip-day">ليلة أخرى <Moon size={17} /></Button></div></div></div></GameFrame>;
}

function Voting({ game, onVote, onResolve }: { game: Game; onVote: (voterId: string, targetId: string) => void; onResolve: () => void }) {
  const alive = game.players.filter((p) => p.alive);
  const allVoted = alive.every((p) => game.votes[p.id]);
  const tally = alive.reduce<Record<string, number>>((acc, p) => { const target = game.votes[p.id]; if (target) acc[target] = (acc[target] || 0) + 1; return acc; }, {});
  return <GameFrame game={game}><div className="mx-auto max-w-4xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-200"><Vote size={27} /></div><div className="text-xs font-semibold tracking-[.25em] text-rose-200/70">جلسة التصويت</div><h1 className="mt-2 font-serif text-3xl font-semibold text-stone-100">من يخرج من المدينة؟</h1><p className="mt-2 text-sm text-stone-500">سجّلوا صوت كل لاعب حي. الأسماء فقط، لا الأدوار.</p></div><div className="grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><h2 className="mb-5 font-serif text-xl text-stone-100">اختيار المتهم</h2><div className="space-y-3">{alive.map((voter) => <div key={voter.id} className="rounded-2xl border border-white/8 bg-black/10 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-stone-200">{voter.name}</span>{game.votes[voter.id] && <Check size={15} className="text-emerald-300" />}</div><div className="flex flex-wrap gap-1.5">{alive.filter((candidate) => candidate.id !== voter.id).map((candidate) => <button data-testid={`button-vote-${voter.id}-${candidate.id}`} key={candidate.id} onClick={() => onVote(voter.id, candidate.id)} className={`rounded-lg px-3 py-2 text-xs transition ${game.votes[voter.id] === candidate.id ? 'bg-rose-300 text-[#26172b]' : 'bg-white/8 text-stone-400 hover:bg-white/15 hover:text-stone-100'}`}>{candidate.name}</button>)}</div></div>)}</div></div><div className="h-fit rounded-3xl border border-white/10 bg-[#211d39] p-5 sm:p-7"><div className="mb-4 flex items-center gap-2 text-amber-300"><Gavel size={18} /><h2 className="font-serif text-xl text-stone-100">صندوق الأصوات</h2></div>{Object.keys(tally).length ? <div className="space-y-3">{Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([id, count]) => <div data-testid={`text-vote-tally-${id}`} key={id} className="flex items-center justify-between rounded-xl bg-black/15 px-3 py-3"><span className="text-sm text-stone-200">{alive.find((p) => p.id === id)?.name}</span><span className="font-serif text-xl text-amber-300">{count}</span></div>)}</div> : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-stone-600">لم تُسجّل أصوات بعد</div>}<Button onClick={onResolve} disabled={!allVoted} className="mt-6 w-full" testId="button-resolve-votes">أعلنوا النتيجة <Gavel size={17} /></Button><p className="mt-3 text-center text-[11px] text-stone-600">{allVoted ? 'كل الأصوات جاهزة للكشف' : `متبقّي ${alive.filter((p) => !game.votes[p.id]).length} أصوات`}</p></div></div></div></GameFrame>;
}

function Result({ game, onReset }: { game: Game; onReset: () => void }) {
  const winner = game.winner;
  return <main className="screen-enter min-h-[100dvh] px-4 py-8 sm:px-8"><div className="mx-auto max-w-4xl"><header className="flex justify-center"><Brand /></header><div className="mt-12 text-center"><div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-[1.7rem] border border-amber-300/30 bg-amber-300/10 text-amber-300 pulse-ring">{winner === 'المافيا' ? <Skull size={36} /> : <Crown size={36} />}</div><div className="text-xs font-semibold tracking-[.3em] text-amber-300/70">انتهت اللعبة</div><h1 data-testid="text-winner" className="mt-3 font-serif text-5xl font-semibold text-stone-50">{game.jesterWon ? 'المهرّج' : winner} يفوز</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-stone-400">{game.jesterWon ? 'أُخرج المهرّج بالتصويت. كان هذا كل ما يريده.' : winner === 'المافيا' ? 'تفوّقت المافيا على المدينة. بعض الأسرار أقوى من الحقيقة.' : 'صمدت المدينة حتى انكشف آخر خيط.'}</p></div><div className="mt-10 rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl text-stone-100">كشف الستار</h2><span className="text-xs text-stone-500">{game.players.length} أدوار</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{game.players.map((p) => { const role = ROLES[p.role]; return <div data-testid={`card-final-role-${p.id}`} key={p.id} className={`rounded-2xl border p-3 ${p.alive ? 'border-emerald-300/15 bg-emerald-300/[.04]' : 'border-white/8 bg-black/10 opacity-75'}`}><div className="text-sm font-semibold text-stone-200">{p.name}</div><div className="mt-1 text-xs text-amber-300">{role.name}</div><div className="mt-1 text-[10px] text-stone-600">{role.team} {p.alive ? '• حي' : '• خرج'}</div></div>; })}</div></div><div className="mt-7 flex justify-center"><Button onClick={onReset} className="min-h-14 px-8" testId="button-new-game-result">ابدأوا لعبة جديدة <RotateCcw size={18} /></Button></div></div></main>;
}

function GameApp() {
  const [game, setGame] = useState<Game | null>(() => { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } });
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { saveGame(game); }, [game]);
  const reset = () => { setGame(null); setConfirmReset(false); };
  const start = (names: string[], roleCounts: Partial<Record<RoleKey, number>>) => {
    const roleList = Object.entries(roleCounts).flatMap(([role, count]) => Array.from({ length: count || 0 }, () => role as RoleKey));
    const shuffledRoles = [...roleList].sort(() => Math.random() - .5);
    const players = names.map((name, index) => ({ id: uid(), name, role: shuffledRoles[index] || 'civilian', alive: true }));
    setGame({ players, phase: 'reveal', round: 0, revealIndex: 0, revealed: false, nightActions: [], dayReport: [], votes: {} });
  };
  const update = (fn: (current: Game) => Game) => setGame((current) => current ? fn(current) : current);
  const reveal = () => update((g) => ({ ...g, revealed: true }));
  const nextReveal = () => update((g) => g.revealIndex < g.players.length - 1 ? ({ ...g, revealIndex: g.revealIndex + 1, revealed: false }) : ({ ...g, phase: 'night', round: 1, revealIndex: 0, revealed: false, nightActions: [], dayReport: [], votes: {} }));
  const nightAction = (actorId: string, targetId?: string) => update((g) => ({ ...g, nightActions: [...g.nightActions, { actorId, role: g.players.find((p) => p.id === actorId)?.role || 'civilian', targetId, skipped: !targetId }] }));
  const finishNight = () => update((g) => {
    const mafia = g.nightActions.find((a) => ['mafia', 'godfather', 'mafioso'].includes(a.role) && a.targetId);
    const doctor = g.nightActions.find((a) => a.role === 'doctor' && a.targetId);
    const bodyguard = g.nightActions.find((a) => a.role === 'bodyguard' && a.targetId);
    const vigilante = g.nightActions.find((a) => a.role === 'vigilante' && a.targetId);
    const victims = [mafia?.targetId, vigilante?.targetId].filter(Boolean) as string[];
    const protectedIds = [doctor?.targetId, bodyguard?.targetId];
    const reportIds = [...new Set(victims.filter((id) => !protectedIds.includes(id)))];
    const silencedIds = g.nightActions.filter((a) => ['witch', 'silencer'].includes(a.role) && a.targetId).map((a) => a.targetId as string);
    const players = g.players.map((p) => reportIds.includes(p.id) ? { ...p, alive: false, silenced: false } : { ...p, silenced: silencedIds.includes(p.id) });
    const aliveAfter = players.filter((p) => p.alive);
    const mafiaAlive = aliveAfter.filter((p) => getTeam(p.role) === 'المافيا').length;
    const oppositionAlive = aliveAfter.filter((p) => getTeam(p.role) !== 'المافيا').length;
    const winner: Team | undefined = mafiaAlive === 0 ? 'المدينة' : mafiaAlive >= oppositionAlive ? 'المافيا' : undefined;
    return winner
      ? { ...g, players, phase: 'result', winner, dayReport: players.filter((p) => reportIds.includes(p.id)).map((p) => p.name), nightActions: [], votes: {}, lastNightInfo: undefined }
      : { ...g, players, phase: 'day', dayReport: players.filter((p) => reportIds.includes(p.id)).map((p) => p.name), nightActions: [], votes: {}, lastNightInfo: undefined };
  });
  const startVoting = () => update((g) => ({ ...g, phase: 'voting', votes: {} }));
  const startNight = () => update((g) => ({ ...g, phase: 'night', round: g.round + 1, nightActions: [], dayReport: [], votes: {}, lastNightInfo: undefined, players: g.players.map((p) => ({ ...p, silenced: false })) }));
  const vote = (voterId: string, targetId: string) => update((g) => ({ ...g, votes: { ...g.votes, [voterId]: targetId } }));
  const resolveVotes = () => update((g) => {
    const tally: Record<string, number> = {};
    Object.values(g.votes).forEach((id) => { tally[id] = (tally[id] || 0) + 1; });
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const topVotes = ranked[0]?.[1] || 0;
    const tiedIds = ranked.filter(([, count]) => count === topVotes).map(([id]) => id);
    const mayor = g.players.find((p) => p.alive && p.role === 'mayor');
    const mayorChoice = mayor ? g.votes[mayor.id] : undefined;
    const eliminatedId = tiedIds.length > 1
      ? (mayorChoice && tiedIds.includes(mayorChoice) ? mayorChoice : undefined)
      : tiedIds[0];
    const eliminated = g.players.find((p) => p.id === eliminatedId);
    const players = eliminated ? g.players.map((p) => p.id === eliminatedId ? { ...p, alive: false } : p) : g.players;
    const jesterWon = eliminated?.role === 'jester';
    const aliveAfter = players.filter((p) => p.alive);
    const mafiaAlive = aliveAfter.filter((p) => getTeam(p.role) === 'المافيا').length;
    const oppositionAlive = aliveAfter.filter((p) => getTeam(p.role) !== 'المافيا').length;
    const winner: Team | undefined = jesterWon ? 'مستقل' : mafiaAlive === 0 ? 'المدينة' : mafiaAlive >= oppositionAlive ? 'المافيا' : undefined;
    const tieNotice = !eliminated && tiedIds.length > 1 ? (mayor ? 'تعادل في الأصوات — استخدموا صوت العمدة للحسم في الجولة التالية.' : 'تعادل في الأصوات — لا أحد يخرج الليلة.') : undefined;
    return winner ? { ...g, players, phase: 'result', winner, jesterWon } : { ...g, players, phase: 'day', dayReport: eliminated ? [eliminated.name] : [], votes: {}, round: g.round, lastNightInfo: tieNotice };
  });
  const content = !game ? <Setup onStart={start} savedGame={game} onResume={() => {}} onReset={reset} /> : game.phase === 'reveal' ? <Reveal game={game} onReveal={reveal} onNext={nextReveal} /> : game.phase === 'night' ? <Night game={game} onAction={nightAction} onFinish={finishNight} /> : game.phase === 'day' ? <Day game={game} onVoteStart={startVoting} onNewNight={startNight} /> : game.phase === 'voting' ? <Voting game={game} onVote={vote} onResolve={resolveVotes} /> : <Result game={game} onReset={reset} />;
  return <AppShell>{content}{game && game.phase !== 'result' && <button data-testid="button-safe-reset" onClick={() => setConfirmReset(true)} className="fixed bottom-4 left-4 z-10 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#211d39]/90 text-stone-500 backdrop-blur transition hover:text-rose-300" title="إعادة ضبط اللعبة"><RotateCcw size={16} /></button>}{confirmReset && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090812]/80 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#211d39] p-6 text-center shadow-2xl"><div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300"><Trash2 size={22} /></div><h2 className="font-serif text-xl font-semibold text-stone-100">إيقاف اللعبة؟</h2><p className="mt-2 text-sm leading-6 text-stone-500">سيُحذف التقدم المحفوظ من هذا الهاتف.</p><div className="mt-6 flex gap-2"><Button onClick={() => setConfirmReset(false)} variant="secondary" className="flex-1" testId="button-cancel-reset">أكمل اللعبة</Button><Button onClick={reset} variant="danger" className="flex-1" testId="button-confirm-reset">نعم، ابدأ من جديد</Button></div></div></div>}</AppShell>;
}

function Router() {
  return <ErrorBoundary resetKey={location.pathname}><Switch><Route path="/" component={GameApp} /><Route component={() => <div className="flex min-h-[100dvh] items-center justify-center text-stone-300">الصفحة غير موجودة</div>} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;