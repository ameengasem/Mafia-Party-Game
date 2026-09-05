import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  BookOpen, Check, ChevronLeft, CircleHelp, Crosshair, Crown, Eye, Gavel,
  HeartPulse, Info, LockKeyhole, MessageCircle, Minus, Moon, Plus,
  RotateCcw, Shield, Skull, SlidersHorizontal, Sparkles, Sun, Swords,
  Trash2, UserRound, Users, Vote, X,
} from 'lucide-react';
import { Route, Switch, Router as WouterRouter } from 'wouter';

type Team = 'المافيا' | 'المدينة' | 'مستقل';
type RoleKey = 'mafia' | 'godfather' | 'mafioso' | 'saboteur' | 'doctor' | 'fielddoctor' | 'detective' | 'psychologist' | 'tracker' | 'reporter' | 'bodyguard' | 'mayor' | 'witch' | 'vigilante' | 'jester' | 'cupid' | 'silencer' | 'illusionist' | 'oracle' | 'civilian' | 'survivor' | 'alien';
type Phase = 'setup' | 'reveal' | 'night' | 'day' | 'voting' | 'result';
type Player = { id: string; name: string; role: RoleKey; alive: boolean; silenced?: boolean; nightUses?: number; alienShieldUsed?: boolean };
type NightAction = { actorId: string; role: RoleKey; targetId?: string; secondaryTargetId?: string; skipped?: boolean };
type Game = { players: Player[]; phase: Phase; round: number; revealIndex: number; revealed: boolean; nightActions: NightAction[]; nightPlayerIndex: number; dayReport: string[]; votes: Record<string, string>; linkedPairs: [string, string][]; winner?: Team; survivorWon?: boolean; lastNightInfo?: string; jesterWon?: boolean; discussionSuggestions?: boolean };

const queryClient = new QueryClient();
const STORAGE_KEY = 'mafia-party-game-v1';

function loadSavedGame(): Game | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Game>;
    if (!Array.isArray(parsed.players) || !parsed.phase) return null;
    return {
      ...parsed,
      players: parsed.players,
      nightActions: Array.isArray(parsed.nightActions) ? parsed.nightActions : [],
      nightPlayerIndex: typeof parsed.nightPlayerIndex === 'number' ? parsed.nightPlayerIndex : 0,
      dayReport: Array.isArray(parsed.dayReport) ? parsed.dayReport : [],
      votes: parsed.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
      linkedPairs: Array.isArray(parsed.linkedPairs) ? parsed.linkedPairs : [],
    } as Game;
  } catch {
    return null;
  }
}

type RoleDefinition = {
  name: string;
  team: Team;
  description: string;
  power: string;
  night: string;
  recommendedMax: number;
  max: number;
  icon: typeof Shield;
  color: string;
};

const ROLES: Record<RoleKey, RoleDefinition> = {
  mafia: { name: 'مافيا', team: 'المافيا', description: 'يختار ضحية كل ليلة مع فريق المافيا.', power: 'متوسطة', night: 'يشارك في اختيار ضحية من اللاعبين الأحياء.', recommendedMax: 4, max: 8, icon: Skull, color: 'rose' },
  godfather: { name: 'العرّاب', team: 'المافيا', description: 'قائد المافيا، يظهر بريئاً أمام المحقق.', power: 'عالية', night: 'ينسّق اختيار ضحية، وتظهر هويته كمدينة أمام المحقق.', recommendedMax: 1, max: 1, icon: Crown, color: 'rose' },
  mafioso: { name: 'مافيوسو', team: 'المافيا', description: 'ذراع المافيا المنفّذ والوفي.', power: 'متوسطة', night: 'ينفّذ قرار المافيا باختيار ضحية.', recommendedMax: 2, max: 4, icon: Swords, color: 'rose' },
  saboteur: { name: 'المخرّب', team: 'المافيا', description: 'يشوش على قدرة لاعب واحد ويمنع أثرها تلك الليلة.', power: 'عالية', night: 'يختار لاعباً؛ تُهمل قدرته الليلية عند حل أحداث الليل.', recommendedMax: 1, max: 1, icon: SlidersHorizontal, color: 'rose' },
  doctor: { name: 'الطبيب', team: 'المدينة', description: 'ينقذ لاعباً واحداً كل ليلة من الموت.', power: 'عالية', night: 'يحمي لاعباً حياً واحداً من ضحية الليل.', recommendedMax: 1, max: 2, icon: HeartPulse, color: 'emerald' },
  fielddoctor: { name: 'المسعف الميداني', team: 'المدينة', description: 'نسخة جريئة من الطبيب؛ يحمي لاعباً، لكن لا يستطيع حماية نفسه.', power: 'عالية', night: 'يحمي لاعباً حياً آخر من ضحية الليل.', recommendedMax: 1, max: 1, icon: HeartPulse, color: 'emerald' },
  detective: { name: 'المحقق', team: 'المدينة', description: 'يتحقق من هوية لاعب واحد كل ليلة.', power: 'عالية', night: 'يفحص لاعباً؛ لا تُعرض النتيجة إلا له.', recommendedMax: 1, max: 2, icon: Eye, color: 'sky' },
  psychologist: { name: 'المحلل النفسي', team: 'المدينة', description: 'يلتقط اتجاه اللاعب من دون كشف دوره بالتفصيل.', power: 'متوسطة', night: 'يفحص لاعباً ويعرف هل ينتمي للمدينة أم خارجها.', recommendedMax: 1, max: 1, icon: MessageCircle, color: 'sky' },
  tracker: { name: 'المتعقّب', team: 'المدينة', description: 'يراقب حركة لاعب في الليل ولا يرى دوره الحقيقي.', power: 'متوسطة', night: 'يفحص لاعباً ويعرف هل لديه قدرة ليلية أم لا.', recommendedMax: 1, max: 1, icon: Crosshair, color: 'sky' },
  reporter: { name: 'مراسل المدينة', team: 'المدينة', description: 'يجمع خبراً صغيراً يساعد النقاش من دون فضح هوية أحد.', power: 'متوسطة', night: 'يفحص لاعباً ويعرف هل هو من الأدوار التي تتحرك ليلاً.', recommendedMax: 1, max: 1, icon: BookOpen, color: 'sky' },
  bodyguard: { name: 'الحارس', team: 'المدينة', description: 'يحمي لاعباً من الخطر، وقد يدفع الثمن بدلاً عنه.', power: 'عالية', night: 'يحمي لاعباً واحداً من الخطر.', recommendedMax: 1, max: 2, icon: Shield, color: 'sky' },
  mayor: { name: 'العمدة', team: 'المدينة', description: 'صوته يحسم التعادل في التصويت.', power: 'متوسطة', night: 'لا فعل ليلي؛ تظهر قوته عند تعادل الأصوات.', recommendedMax: 1, max: 1, icon: Gavel, color: 'amber' },
  witch: { name: 'الساحرة', team: 'المدينة', description: 'تستطيع إسكات لاعب واحد مرة واحدة في اللعبة.', power: 'عالية', night: 'تختار لاعباً يصمت في نقاش الغد؛ لا يمكنها استخدام القدرة مرة أخرى.', recommendedMax: 1, max: 1, icon: Sparkles, color: 'violet' },
  vigilante: { name: 'المنتقم', team: 'المدينة', description: 'يملك رصاصة واحدة لمواجهة الخطر ليلاً.', power: 'عالية', night: 'يستهدف لاعباً واحداً مرة واحدة؛ قد يخرج من اللعبة.', recommendedMax: 1, max: 1, icon: Crosshair, color: 'amber' },
  jester: { name: 'المهرّج', team: 'مستقل', description: 'يفوز وحده إن طُرد بالتصويت.', power: 'مربكة', night: 'لا فعل ليلي؛ هدفه أن يقنع المدينة بإخراجه.', recommendedMax: 1, max: 1, icon: Sparkles, color: 'fuchsia' },
  cupid: { name: 'كيوبيد', team: 'مستقل', description: 'يربط لاعبين في بداية اللعبة؛ إذا مات أحدهما يتأثر الآخر.', power: 'متوسطة', night: 'يربط لاعبين في بداية اللعبة وفق قواعد المجموعة.', recommendedMax: 1, max: 1, icon: HeartPulse, color: 'pink' },
  silencer: { name: 'المُسكت', team: 'المافيا', description: 'يمنع لاعباً من الكلام في نقاش الغد.', power: 'عالية', night: 'يختار لاعباً لا يتكلم في نقاش الغد.', recommendedMax: 1, max: 2, icon: LockKeyhole, color: 'rose' },
  illusionist: { name: 'المخادع', team: 'مستقل', description: 'يترك أثراً من الضباب ويمنع لاعباً من الكلام في الصباح.', power: 'مربكة', night: 'يختار لاعباً يصمت في نقاش الغد؛ لا يكشف فريقه.', recommendedMax: 1, max: 1, icon: Sparkles, color: 'fuchsia' },
  oracle: { name: 'العرّافة', team: 'مستقل', description: 'تملك رؤية واحدة دقيقة، ثم تنطفئ قدرتها.', power: 'عالية', night: 'تكشف الدور الكامل للاعب واحد مرة واحدة طوال اللعبة.', recommendedMax: 1, max: 1, icon: Eye, color: 'violet' },
  civilian: { name: 'مواطن', team: 'المدينة', description: 'لا يملك قدرة خاصة؛ قوته في الملاحظة والتصويت.', power: 'بلا قدرة', night: 'ينام طوال الليل ويراقب النقاش في النهار.', recommendedMax: 50, max: 50, icon: Users, color: 'slate' },
  survivor: { name: 'الناجي', team: 'مستقل', description: 'يفوز إن بقي حياً حتى نهاية اللعبة.', power: 'منخفضة', night: 'لا فعل ليلي؛ هدفه البقاء حتى النهاية.', recommendedMax: 1, max: 1, icon: Shield, color: 'teal' },
  alien: { name: 'الزائر الغريب', team: 'مستقل', description: 'يقاوم أول محاولة قتل ليلية، ثم يصبح بشرياً مثل الجميع.', power: 'مفاجئة', night: 'لا فعل ليلي؛ درعه يمنع أول ضربة ليلية فقط.', recommendedMax: 1, max: 1, icon: CircleHelp, color: 'teal' },
};

const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

const DEFAULT_NAMES = ['', '', '', '', ''];

function uid() { return Math.random().toString(36).slice(2, 10); }
function saveGame(game: Game | null) { if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); else localStorage.removeItem(STORAGE_KEY); }
function getTeam(role: RoleKey) { return ROLES[role].team; }
function teamClass(team: Team) { return team === 'المافيا' ? 'bg-rose-400/10 text-rose-300' : team === 'المدينة' ? 'bg-sky-400/10 text-sky-300' : 'bg-violet-400/10 text-violet-300'; }
function getWinnerState(players: Player[]) {
  const alive = players.filter((player) => player.alive);
  const mafiaAlive = alive.filter((player) => getTeam(player.role) === 'المافيا').length;
  const oppositionAlive = alive.filter((player) => getTeam(player.role) !== 'المافيا').length;
  const winner: Team | undefined = mafiaAlive === 0 ? 'المدينة' : mafiaAlive >= oppositionAlive ? 'المافيا' : undefined;
  return { winner, survivorWon: Boolean(winner && alive.some((player) => player.role === 'survivor')) };
}

function AppShell({ children }: { children: ReactNode }) {
  return <div dir="rtl" className="relative min-h-[100dvh] overflow-x-hidden"><div className="app-noise" />{children}</div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? '' : 'justify-center'}`}>
    <div className="relative flex size-11 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-300 shadow-[0_8px_30px_rgba(238,190,75,.13)]"><Moon size={22} strokeWidth={1.8} /><span className="absolute -bottom-1 -left-1 size-2 rounded-full bg-rose-400" /></div>
    <div><div className="font-serif text-xl font-semibold tracking-tight text-stone-50">مافيا</div><div className="text-[10px] font-medium tracking-[.22em] text-amber-300/60">ليلة واحدة • أسرار كثيرة</div></div>
  </div>;
}

function Button({ children, onClick, variant = 'primary', disabled = false, className = '', type = 'button', testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit'; testId?: string }) {
  const styles = {
    primary: 'bg-amber-300 text-[#1b182d] shadow-[0_8px_25px_rgba(238,190,75,.18)] hover:bg-amber-200',
    secondary: 'border border-white/10 bg-white/[.07] text-stone-100 hover:bg-white/[.12]',
    ghost: 'text-stone-300 hover:bg-white/[.08] hover:text-white',
    danger: 'border border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20',
  };
  return <button type={type} data-testid={testId} onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 active:translate-y-px ${styles[variant]} ${className}`}>{children}</button>;
}

function Progress({ phase, setupStep }: { phase: Phase; setupStep?: 1 | 2 }) {
  const phases: { key: Phase; label: string }[] = [{ key: 'setup', label: setupStep === 2 ? 'الأدوار' : 'اللاعبون' }, { key: 'reveal', label: 'الكشف' }, { key: 'night', label: 'الليل' }, { key: 'day', label: 'النهار' }, { key: 'voting', label: 'التصويت' }];
  const index = Math.max(0, phases.findIndex((p) => p.key === phase));
  return <div className="mx-auto flex max-w-2xl items-center justify-between gap-1 px-1" aria-label="مراحل اللعبة">
    {phases.map((p, i) => <div key={p.key} className="flex flex-1 items-center gap-1.5">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${i <= index ? 'border-amber-300 bg-amber-300 text-[#1b182d]' : 'border-white/15 text-stone-500'}`}>{i < index ? <Check size={14} /> : i + 1}</div>
      <span className={`hidden text-[11px] sm:block ${i <= index ? 'text-stone-200' : 'text-stone-600'}`}>{p.label}</span>
      {i < phases.length - 1 && <div className={`h-px flex-1 ${i < index ? 'bg-amber-300/70' : 'bg-white/10'}`} />}
    </div>)}
  </div>;
}

function RoleGuide({ onClose, privateRole }: { onClose: () => void; privateRole?: RoleKey }) {
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#090812]/85 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="role-guide-title">
    <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#211d39] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="mb-6 flex items-center justify-between"><div><div className="text-xs font-semibold tracking-wider text-amber-300/80">مرجع سريع</div><h2 id="role-guide-title" className="mt-1 font-serif text-2xl font-semibold text-stone-100">دليل الأدوار والقدرات</h2></div><button data-testid="button-close-role-guide" onClick={onClose} aria-label="إغلاق دليل الأدوار" className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-stone-400 hover:text-white"><X size={19} /></button></div>
      {privateRole && <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/[.08] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-amber-200"><LockKeyhole size={15} /> دورك الخاص الآن</div><div className="mt-2 flex items-center justify-between gap-3"><div><div className="font-serif text-xl text-stone-100">{ROLES[privateRole].name}</div><div className="mt-1 text-xs text-stone-400">{ROLES[privateRole].team} • القوة: {ROLES[privateRole].power}</div></div><div className="rounded-lg bg-black/15 px-3 py-2 text-xs text-amber-100">{ROLES[privateRole].night}</div></div><p className="mt-3 text-xs leading-6 text-amber-100/70">هذه المعلومة للاعب الحالي فقط. أخفِ الشاشة قبل تمرير الهاتف.</p></div>}
      <div className="grid gap-2 sm:grid-cols-2">{ROLE_KEYS.map((key) => { const role = ROLES[key]; const Icon = role.icon; return <div data-testid={`card-role-${key}`} key={key} className="rounded-2xl border border-white/8 bg-black/10 p-3.5"><div className="flex gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Icon size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 font-semibold text-stone-200">{role.name}<span className={`rounded-full px-2 py-0.5 text-[10px] ${teamClass(role.team)}`}>{role.team}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-stone-400">القوة: {role.power}</span></div><p className="mt-1 text-xs leading-5 text-stone-400">{role.description}</p><p className="mt-1 text-[11px] leading-5 text-amber-100/60"><span className="text-stone-500">في الليل:</span> {role.night}</p><p className="mt-1 text-[11px] text-stone-600">الحد المقترح: {role.recommendedMax === 50 ? 'حسب عدد اللاعبين' : `${role.recommendedMax}`}</p></div></div></div>; })}</div>
    </div>
  </div>;
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  const steps = [
    ['١', 'جهّزوا الغرفة', 'أضيفوا أسماء اللاعبين، ثم اختاروا الأدوار وعدد كل دور حتى يساوي المجموع عدد اللاعبين.'],
    ['٢', 'اكشفوا البطاقات سراً', 'يمرّر اللاعب الهاتف إلى الشخص المكتوب اسمه، يشاهد بطاقته، ثم يخفي الشاشة قبل تمريرها.'],
    ['٣', 'مرّروا الهاتف في الليل', 'يظهر اسم المستلم أولاً من دون كشف قدرته. يضغط اللاعب على زر الاستلام ثم ينفّذ قدرته أو يتخطاها.'],
    ['٤', 'ناقشوا الصباح', 'يُعرض ما حدث في الليل وشرارة نقاش محايدة. لا تعتبروا الاقتراح دليلاً ولا تكشفوا أي دور.'],
    ['٥', 'صوّتوا حتى النهاية', 'كل لاعب حي يصوّت، والعمدة يحسم التعادل. تنتهي اللعبة عندما تفوز المافيا أو المدينة أو المهرّج.'],
  ];
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#090812]/85 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="how-to-play-title">
    <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#211d39] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4"><div><div className="text-xs font-semibold tracking-wider text-amber-300/80">دليل سريع</div><h2 id="how-to-play-title" className="mt-1 font-serif text-2xl font-semibold text-stone-100">كيف تسير ليلة المافيا؟</h2><p className="mt-2 text-sm leading-6 text-stone-400">اللعبة تعتمد على جهاز واحد. الخصوصية أهم من السرعة: اقرأوا اسم مستلم الهاتف قبل كل معلومة سرية.</p></div><button data-testid="button-close-how-to-play" onClick={onClose} aria-label="إغلاق شرح اللعبة" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-stone-400 hover:text-white"><X size={19} /></button></div>
      <div className="space-y-2">{steps.map(([number, title, text]) => <div key={number} className="flex gap-3 rounded-2xl border border-white/8 bg-black/10 p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-sm font-bold text-amber-300">{number}</span><div><h3 className="font-semibold text-stone-100">{title}</h3><p className="mt-1 text-sm leading-6 text-stone-400">{text}</p></div></div>)}</div>
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-indigo-200/15 bg-indigo-300/[.06] p-4 text-xs leading-6 text-indigo-100/70"><LockKeyhole className="mt-1 shrink-0 text-indigo-200" size={15} /> لا تفتحوا دليل الأدوار أثناء تسليم الهاتف إلا للاعب الحالي؛ بعض المعلومات فيه خاصة.</div>
    </div>
  </div>;
}

function Setup({ onStart, savedGame, onResume, onReset }: { onStart: (names: string[], roles: Partial<Record<RoleKey, number>>, discussionSuggestions: boolean) => void; savedGame: Game | null; onResume: () => void; onReset: () => void }) {
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [roleCounts, setRoleCounts] = useState<Partial<Record<RoleKey, number>>>({});
  const [newPlayerName, setNewPlayerName] = useState('');
  const [discussionSuggestions, setDiscussionSuggestions] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [help, setHelp] = useState(false);
  const [howToPlay, setHowToPlay] = useState(false);
  const cleanNames = names.map((name) => name.trim()).filter(Boolean);
  const hasDuplicates = new Set(cleanNames.map((name) => name.toLocaleLowerCase())).size !== cleanNames.length;
  const hasBlank = names.some((name) => !name.trim());
  const validPlayerList = cleanNames.length >= 5 && cleanNames.length <= 50 && !hasDuplicates && !hasBlank;
  const roleTotal = ROLE_KEYS.reduce((total, role) => total + (roleCounts[role] || 0), 0);
  const hasMafia = (roleCounts.mafia || 0) > 0;
  const canStart = validPlayerList && roleTotal === cleanNames.length && hasMafia;
  const addPlayer = () => { if (names.length < 50) setNames((current) => [...current, '']); };
  const addNamedPlayer = () => {
    const name = newPlayerName.trim();
    if (!name || names.length >= 50 || cleanNames.some((existing) => existing.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    setNames((current) => [...current, name]);
    setNewPlayerName('');
  };
  const removePlayer = (index: number) => { if (names.length > 1) setNames((current) => current.filter((_, row) => row !== index)); };
  const updateName = (index: number, value: string) => setNames((current) => current.map((name, row) => row === index ? value : name));
  const updateCount = (role: RoleKey, value: number) => { setRoleCounts((current) => ({ ...current, [role]: Math.max(0, Math.min(ROLES[role].max, Number.isFinite(value) ? value : 0)) })); };
  const toggleRole = (role: RoleKey) => { setRoleCounts((current) => ({ ...current, [role]: current[role] ? 0 : 1 })); };
  return <main className="screen-enter mx-auto min-h-[100dvh] max-w-7xl px-4 py-6 sm:px-8 lg:px-12">
    <header className="flex items-center justify-between"><Brand compact /><div className="flex items-center gap-2"><button data-testid="button-how-to-play" onClick={() => setHowToPlay(true)} aria-label="شرح طريقة اللعب" className="flex size-11 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/10 hover:text-amber-200"><Info size={19} /></button><button data-testid="button-help" onClick={() => setHelp(true)} aria-label="فتح دليل الأدوار" className="flex size-11 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/10 hover:text-amber-200"><CircleHelp size={20} /></button></div></header>
    <div className="mx-auto mt-10 max-w-5xl">
      <div className="mb-8 max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[.07] px-3 py-1.5 text-xs text-amber-200"><Sparkles size={13} /> جهّزوا المسرح</div><h1 className="font-serif text-4xl font-semibold leading-[1.25] tracking-tight text-stone-50 sm:text-6xl">كل شخص هنا<br /><span className="text-amber-300">يخفي شيئاً.</span></h1><p className="mt-4 max-w-md text-base leading-8 text-stone-400">مرّروا الهاتف. لا تنظروا إلى الشاشة إلا عندما يحين دوركم. الليلة، الحقيقة لا تظهر دفعة واحدة.</p></div>
      {savedGame && savedGame.phase !== 'result' && <div className="rise-in mb-5 flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[.07] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-amber-300/15 text-amber-300"><RotateCcw size={18} /></div><div><div className="font-semibold text-stone-100">لديكم لعبة لم تنتهِ</div><div className="text-xs text-stone-400">الجولة {savedGame.round} • {savedGame.players.filter((p) => p.alive).length} لاعباً على قيد اللعب</div></div></div><div className="flex gap-2"><Button onClick={onResume} className="min-h-10 px-4 text-xs" testId="button-resume">استئناف اللعبة</Button><Button onClick={onReset} variant="ghost" className="min-h-10 px-3 text-xs" testId="button-discard">لعبة جديدة</Button></div></div>}
      <div className="mb-5"><Progress phase="setup" setupStep={step} /></div>
      {step === 1 ? <section className="rise-in rounded-3xl border border-white/10 bg-white/[.045] p-5 shadow-2xl shadow-black/10 sm:p-7">
         <div className="mb-6 flex items-end justify-between gap-3"><div><div className="mb-1 text-xs font-semibold tracking-wider text-amber-300/80">الخطوة ١ من ٢</div><h2 className="font-serif text-2xl font-semibold text-stone-100">من في الغرفة؟</h2><p className="mt-1 text-sm text-stone-500">اكتبوا اسماً في كل خانة، وأضيفوا أو احذفوا الصفوف بسهولة.</p></div><span data-testid="text-player-count" className={`shrink-0 rounded-full px-3 py-1 text-xs ${validPlayerList ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{cleanNames.length} / 50 لاعباً</span></div>
         <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-3 sm:flex-row"><input data-testid="input-new-player-name" value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addNamedPlayer(); }} placeholder="اكتب الاسم ثم اضغط + لإضافته إلى الغرفة" aria-label="اسم لاعب جديد" maxLength={40} className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#161429] px-4 text-base text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/10" /><button data-testid="button-add-named-player" onClick={addNamedPlayer} disabled={!newPlayerName.trim() || names.length >= 50} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-bold text-[#1b182d] transition hover:bg-amber-200 disabled:cursor-not-allowed"><Plus size={18} /> إضافة للغرفة</button></div>
         <div className="space-y-2.5">{names.map((name, index) => <div key={`player-row-${index}`} className="flex items-center gap-2 rounded-2xl border border-white/6 bg-black/10 p-1.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/[.08] text-xs text-amber-200">{index + 1}</span><input data-testid={`input-player-name-${index}`} value={name} onChange={(event) => updateName(index, event.target.value)} placeholder={`اسم اللاعب ${index + 1}`} aria-label={`اسم اللاعب ${index + 1}`} maxLength={40} className="min-h-12 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base text-stone-100 outline-none transition placeholder:text-stone-600 focus:bg-white/[.03]" /><button data-testid={`button-remove-player-${index}`} onClick={() => removePlayer(index)} disabled={names.length <= 1} aria-label={`حذف اللاعب ${index + 1}`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-stone-500 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-rose-300 disabled:opacity-30"><Minus size={18} /></button></div>)}</div>
         <button data-testid="button-add-player" onClick={addPlayer} disabled={names.length >= 50} className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300/35 bg-amber-300/[.04] text-sm font-semibold text-amber-200 transition hover:border-amber-300/70 hover:bg-amber-300/[.09]"><span className="flex size-8 items-center justify-center rounded-full bg-amber-300 text-[#1b182d]"><Plus size={19} /></span>إضافة خانة فارغة</button>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs"><span className={hasDuplicates || hasBlank ? 'text-rose-300' : 'text-stone-500'}>{hasBlank ? 'أكملوا الأسماء الفارغة أو احذفوا الصف.' : hasDuplicates ? 'يجب أن يكون كل اسم مختلفاً.' : cleanNames.length < 5 ? `أضيفوا ${5 - cleanNames.length} أسماء أخرى على الأقل.` : 'الأسماء جاهزة للخطوة التالية.'}</span><span className="text-stone-600">الحد الأدنى ٥ • الحد الأقصى ٥٠</span></div>
        <div className="mt-7 flex justify-end"><Button onClick={() => setStep(2)} disabled={!validPlayerList} className="min-h-14 px-8 text-base" testId="button-next-roles">التالي: اختيار الأدوار <ChevronLeft size={18} /></Button></div>
      </section> : <section className="rise-in">
         <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><div className="mb-1 text-xs font-semibold tracking-wider text-amber-300/80">الخطوة ٢ من ٢</div><h2 className="font-serif text-2xl font-semibold text-stone-100">اختاروا أدوار الليلة</h2><p className="mt-1 text-sm text-stone-500">اضغطوا على البطاقة لتفعيل الدور، ثم اكتبوا العدد. كل دور له حد أقصى واضح.</p></div><div className={`rounded-full px-3 py-1.5 text-xs ${roleTotal === cleanNames.length ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`} data-testid="text-role-total">مجموع الأدوار {roleTotal} / {cleanNames.length}</div></div>
         <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-indigo-200/15 bg-indigo-300/[.05] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200"><MessageCircle size={17} /></div><div><div className="text-sm font-semibold text-indigo-100">مساعدة النقاش الصباحية</div><p className="mt-1 text-xs leading-6 text-indigo-100/60">تعرض سؤالاً محايداً ولاعباً أو اثنين لفتح الحوار، من دون كشف أي دور أو ادعاء دليل.</p></div></div><button data-testid="toggle-discussion-suggestions" onClick={() => setDiscussionSuggestions((value) => !value)} aria-pressed={discussionSuggestions} className={`relative h-7 w-12 shrink-0 rounded-full transition ${discussionSuggestions ? 'bg-indigo-300' : 'bg-white/15'}`}><span className={`absolute top-1 size-5 rounded-full bg-[#211d39] transition ${discussionSuggestions ? 'right-1' : 'right-6'}`} /><span className="sr-only">{discussionSuggestions ? 'اقتراحات مفعلة' : 'اقتراحات معطلة'}</span></button></div>
          <div className="mb-3 flex items-center gap-2 text-xs text-stone-500"><SlidersHorizontal size={15} className="text-amber-300" /> اختاروا الأدوار بأنفسكم. لا توجد تشكيلة جاهزة مفروضة؛ الحد الأقصى لكل دور محدد حسب قوة تأثيره.</div>
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ROLE_KEYS.map((key) => { const role = ROLES[key]; const Icon = role.icon; const count = roleCounts[key] || 0; const enabled = count > 0; return <div data-testid={`card-role-setup-${key}`} key={key} className={`rounded-2xl border p-4 transition ${enabled ? 'border-amber-300/25 bg-[#211d39]' : 'border-white/8 bg-black/10 opacity-75'}`}><div className="flex items-start justify-between gap-3"><button data-testid={`button-toggle-role-${key}`} onClick={() => toggleRole(key)} aria-pressed={enabled} className="flex min-w-0 items-center gap-2 text-right"><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${enabled ? 'bg-amber-300/10 text-amber-300' : 'bg-white/5 text-stone-600'}`}><Icon size={17} /></span><span><span className="block text-sm font-semibold text-stone-200">{role.name}</span><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${teamClass(role.team)}`}>{role.team}</span></span></button><button data-testid={`button-toggle-role-switch-${key}`} onClick={() => toggleRole(key)} aria-label={`${enabled ? 'تعطيل' : 'تفعيل'} دور ${role.name}`} aria-pressed={enabled} className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-amber-300' : 'bg-white/15'}`}><span className={`absolute top-1 size-4 rounded-full bg-[#211d39] transition ${enabled ? 'right-1' : 'right-6'}`} /></button></div><p className="mt-3 text-xs leading-5 text-stone-500">{role.description}</p><div className="mt-3 flex items-end justify-between gap-2 border-t border-white/8 pt-3"><div className="text-[11px] leading-5 text-stone-600">القوة {role.power}<br />المقترح حتى {role.recommendedMax === 50 ? 'حسب المجموعة' : role.recommendedMax}<br />الحد الأقصى {role.max}</div><label className="text-left text-[11px] text-stone-500">العدد<input data-testid={`input-role-${key}`} type="number" min="0" max={role.max} value={count} disabled={!enabled} onChange={(event) => updateCount(key, Number(event.target.value))} aria-label={`عدد دور ${role.name}`} className="mt-1 block w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-center text-lg font-semibold text-stone-100 outline-none focus:border-amber-300 disabled:text-stone-600" /></label></div></div>; })}</div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><button data-testid="button-back-players" onClick={() => setStep(1)} className="inline-flex min-h-12 items-center justify-center gap-2 text-sm text-stone-400 transition hover:text-amber-200"><ChevronLeft className="rotate-180" size={16} /> العودة إلى اللاعبين</button><div className="flex flex-col gap-3 sm:flex-row"><button data-testid="button-how-to-play-roles" onClick={() => setHowToPlay(true)} className="inline-flex min-h-12 items-center justify-center gap-2 text-sm text-stone-400 transition hover:text-amber-200"><Info size={16} /> كيف نلعب؟</button><button data-testid="button-open-role-guide" onClick={() => setHelp(true)} className="inline-flex min-h-12 items-center justify-center gap-2 text-sm text-stone-400 transition hover:text-amber-200"><BookOpen size={16} /> شرح الأدوار</button><Button onClick={() => onStart(cleanNames, roleCounts, discussionSuggestions)} disabled={!canStart} className="min-h-14 px-8 text-base" testId="button-start-game">وزّعوا الأدوار <ChevronLeft size={18} /></Button></div></div>
         {!canStart && <div className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-amber-200/70"><Info size={14} /> {roleTotal !== cleanNames.length ? 'يجب أن يساوي مجموع الأدوار عدد اللاعبين تماماً.' : !hasMafia ? 'يجب تفعيل دور مافيا واحد على الأقل.' : 'أكملوا إعداد اللعبة للبدء.'}</div>}
      </section>}
    </div>
     {help && <RoleGuide onClose={() => setHelp(false)} />}
     {howToPlay && <HowToPlay onClose={() => setHowToPlay(false)} />}
  </main>;
}

function GameFrame({ game, children, privateRole }: { game: Game; children: ReactNode; privateRole?: RoleKey }) {
  const [guide, setGuide] = useState(false);
  const [howToPlay, setHowToPlay] = useState(false);
  return <main className="screen-enter min-h-[100dvh] px-4 py-5 sm:px-8"><header className="mx-auto mb-6 flex max-w-5xl items-center justify-between"><Brand compact /><div className="flex items-center gap-2"><button data-testid="button-open-how-to-play-game" onClick={() => setHowToPlay(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-stone-400 transition hover:border-amber-300/30 hover:text-amber-200" title="شرح طريقة اللعب"><Info size={15} /> <span className="hidden sm:inline">كيف نلعب؟</span></button><button data-testid="button-open-role-guide-game" onClick={() => setGuide(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-stone-400 transition hover:border-amber-300/30 hover:text-amber-200" title="فتح دليل الأدوار"><BookOpen size={15} /> <span className="hidden sm:inline">الأدوار</span></button><div className="text-left"><div className="text-[10px] tracking-wider text-stone-600">الجولة</div><div data-testid="text-round" className="font-serif text-lg text-amber-300">{game.round}</div></div></div></header><div className="mx-auto mb-8 max-w-5xl"><Progress phase={game.phase} /></div>{children}{guide && <RoleGuide onClose={() => setGuide(false)} privateRole={privateRole} />}{howToPlay && <HowToPlay onClose={() => setHowToPlay(false)} />}</main>;
}

function Reveal({ game, onReveal, onNext }: { game: Game; onReveal: () => void; onNext: () => void }) {
  const player = game.players[game.revealIndex];
  const role = ROLES[player.role];
  const Icon = role.icon;
  return <GameFrame game={game} privateRole={game.revealed ? player.role : undefined}><div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center text-center"><div className="mb-5 flex items-center gap-2 text-xs text-stone-500"><LockKeyhole size={15} className="text-amber-300" /> الكشف خاص — مرّروا الهاتف بعد الإخفاء</div><div className="mb-5 text-sm text-stone-400">اللاعب {game.revealIndex + 1} من {game.players.length}</div>{!game.revealed ? <><div className="pulse-ring mb-8 flex size-28 items-center justify-center rounded-[2rem] border border-amber-300/25 bg-amber-300/[.08] text-amber-300"><Eye size={42} strokeWidth={1.3} /></div><h1 className="font-serif text-3xl font-semibold text-stone-100">هل أنت <span className="text-amber-300">{player.name}</span>؟</h1><p className="mt-3 max-w-xs text-sm leading-7 text-stone-500">تأكد أن الجميع لا ينظر. اضغط عندما تكون مستعداً لرؤية دورك.</p><Button onClick={onReveal} className="mt-8 min-h-14 w-full max-w-xs text-base" testId={`button-reveal-${player.id}`}>أنا {player.name}، أريد كشف دوري <Eye size={18} /></Button></> : <div className="rise-in w-full"><div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-[2rem] border border-amber-300/40 bg-amber-300/10 text-amber-300"><Icon size={48} strokeWidth={1.4} /></div><div className="text-sm text-stone-400">دورك في هذه الليلة</div><h1 data-testid={`text-role-reveal-${player.id}`} className="mt-2 font-serif text-5xl font-semibold text-amber-300">{role.name}</h1><div className="mx-auto mt-4 inline-flex rounded-full bg-white/8 px-3 py-1 text-xs text-stone-300">{role.team} • القوة: {role.power}</div><p className="mx-auto mt-5 max-w-xs text-sm leading-7 text-stone-400">{role.description}</p><div className="mx-auto mt-4 max-w-xs rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-right"><div className="mb-1 text-xs font-semibold text-amber-200">قدرتك في الليل</div><p className="text-xs leading-6 text-stone-300">{role.night}</p></div><div className="mx-auto mt-5 max-w-xs rounded-xl border border-rose-300/15 bg-rose-300/[.05] p-3 text-xs leading-6 text-rose-100/70">احفظ دورك جيداً. لا تكشفه لأحد، ثم أخفِ الشاشة قبل تمرير الهاتف.</div><Button onClick={onNext} className="mt-6 min-h-14 w-full max-w-xs" testId={`button-hide-role-${player.id}`}>{game.revealIndex === game.players.length - 1 ? 'ابدأ الليل الأول' : 'أخفي دوري ومرّر الهاتف'} <ChevronLeft size={18} /></Button></div>}</div></GameFrame>;
}

function Night({ game, onAction, onNextPlayer, onFinish }: { game: Game; onAction: (actorId: string, targetId?: string, secondaryTargetId?: string) => void; onNextPlayer: () => void; onFinish: () => void }) {
  const [privateNotice, setPrivateNotice] = useState<string | null>(null);
  const [cupidFirstTarget, setCupidFirstTarget] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const living = game.players.filter((player) => player.alive);
  const playerIndex = game.nightPlayerIndex ?? 0;
  const actor = living[playerIndex];
  useEffect(() => {
    setReady(false);
    setPrivateNotice(null);
    setCupidFirstTarget(null);
  }, [actor?.id]);
  const nightRoles: RoleKey[] = ['mafia', 'godfather', 'mafioso', 'saboteur', 'doctor', 'fielddoctor', 'detective', 'psychologist', 'tracker', 'reporter', 'bodyguard', 'witch', 'vigilante', 'silencer', 'illusionist', 'oracle', 'cupid'];
  const oneUseRoles: RoleKey[] = ['witch', 'vigilante', 'oracle', 'cupid'];
  const hasAbility = Boolean(actor && nightRoles.includes(actor.role) && !(oneUseRoles.includes(actor.role) && (actor.nightUses || 0) > 0) && (actor.role !== 'cupid' || game.round === 1));
  const finished = !actor;
  const role = actor ? ROLES[actor.role] : null;
  const Icon = role?.icon || Moon;
  const targetable = living.filter((target) => {
    if (!actor) return false;
    if (actor.role === 'fielddoctor' && target.id === actor.id) return false;
    return target.id !== actor.id || actor.role === 'doctor';
  });
  const submitAction = (targetId?: string, secondaryTargetId?: string) => {
    if (!actor || !hasAbility) return;
    if (actor.role === 'cupid' && targetId && !secondaryTargetId && !cupidFirstTarget) {
      setCupidFirstTarget(targetId);
      return;
    }
    const target = targetId ? game.players.find((player) => player.id === targetId) : undefined;
    onAction(actor.id, targetId, secondaryTargetId);
    setCupidFirstTarget(null);
    if (!target) {
      setPrivateNotice('تم تسجيل تخطي القدرة. أخفِ الشاشة ومرّر الهاتف.');
    } else if (actor.role === 'detective') {
      const isMafia = target.role !== 'godfather' && getTeam(target.role) === 'المافيا';
      setPrivateNotice(`نتيجة التحقيق: ${target.name} ${isMafia ? 'من المافيا.' : 'ليس من المافيا.'}`);
    } else if (actor.role === 'psychologist') {
      setPrivateNotice(`قراءة ${target.name}: ${getTeam(target.role) === 'المدينة' ? 'ينتمي إلى المدينة.' : 'ليس من المدينة.'}`);
    } else if (actor.role === 'tracker' || actor.role === 'reporter') {
      setPrivateNotice(`${target.name} ${nightRoles.includes(target.role) ? 'لديه حركة ليلية.' : 'لا يملك حركة ليلية.'}`);
    } else if (actor.role === 'oracle') {
      setPrivateNotice(`رؤية العرّافة: دور ${target.name} هو «${ROLES[target.role].name}».`);
    } else if (actor.role === 'saboteur') {
      setPrivateNotice(`تم تشويش ${target.name}. لن تُحتسب قدرته هذه الليلة.`);
    } else if (actor.role === 'cupid') {
      const second = secondaryTargetId ? game.players.find((player) => player.id === secondaryTargetId) : undefined;
      setPrivateNotice(second ? `تم ربط ${target.name} و${second.name}. إذا خرج أحدهما، يتأثر الآخر.` : 'اختر لاعبين لربطهما.');
    } else {
      setPrivateNotice('تم تسجيل الفعل السري. أخفِ الشاشة ومرّر الهاتف.');
    }
  };
  return <GameFrame game={game} privateRole={privateNotice || !ready ? undefined : actor?.role}>
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-300/10 text-indigo-200"><Moon size={27} /></div>
        <div className="text-xs font-semibold tracking-[.25em] text-indigo-200/70">الليل {game.round}</div>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-stone-100">{finished ? 'نامت المدينة' : 'مرّروا الهاتف بهدوء'}</h1>
        <p className="mt-2 text-sm text-stone-500">{finished ? 'تمت كل المراحل السرية. حان وقت الصباح.' : `اللاعب ${playerIndex + 1} من ${living.length} — لا تفتحوا الشاشة إلا للشخص المكتوب اسمه.`}</p>
      </div>
      {privateNotice ? <div className="rise-in rounded-3xl border border-amber-300/25 bg-amber-300/[.07] p-7 text-center sm:p-10">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300"><LockKeyhole size={30} /></div>
        <div className="text-xs tracking-wider text-amber-200/70">معلومة خاصة</div>
        <h2 data-testid="text-private-night-result" className="mt-3 font-serif text-2xl font-semibold text-stone-100">{privateNotice}</h2>
        <p className="mt-3 text-sm leading-7 text-stone-500">احفظها جيداً، ثم أخفِ الشاشة قبل تمرير الهاتف للاعب التالي.</p>
        <Button onClick={() => { setPrivateNotice(null); onNextPlayer(); }} className="mt-7 min-h-14 w-full sm:w-auto" testId="button-hide-night-result">أخفي الشاشة ومرّر الهاتف <ChevronLeft size={18} /></Button>
      </div> : finished ? <div className="rise-in rounded-3xl border border-indigo-200/15 bg-indigo-300/[.06] p-6 text-center sm:p-10">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-indigo-300/10 text-indigo-200"><Check size={30} /></div>
        <h2 className="font-serif text-2xl font-semibold text-stone-100">مرّ الهاتف على الجميع</h2>
        <p className="mt-2 text-sm text-stone-400">أعلنوا الصباح لمعرفة ما حدث.</p>
        <Button onClick={onFinish} className="mt-7 min-h-14 w-full sm:w-auto" testId="button-finish-night">أعلنوا الصباح <Sun size={18} /></Button>
       </div> : <div className="rise-in rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-white/8 pb-5">
           <div className="flex size-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">{ready ? <Icon size={21} /> : <LockKeyhole size={21} />}</div>
          <div><div className="text-xs text-stone-500">سلّم الهاتف إلى</div><div data-testid={`text-night-actor-${actor.id}`} className="font-semibold text-stone-100">{actor.name}</div></div>
          <div className="mr-auto rounded-full bg-indigo-300/10 px-3 py-1 text-[10px] text-indigo-200">دور سري {playerIndex + 1}/{living.length}</div>
        </div>
         {!ready ? <div className="rounded-2xl border border-indigo-200/15 bg-indigo-300/[.05] p-7 text-center"><LockKeyhole className="mx-auto mb-4 text-indigo-200" size={30} /><h2 className="font-serif text-2xl text-stone-100">هذه الشاشة لـ {actor.name} فقط</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-stone-400">تأكد أن الجميع لا ينظر. بعد استلام الهاتف اضغط الزر لعرض دورك وتعليماتك السرية.</p><Button onClick={() => setReady(true)} className="mt-6 min-h-14 w-full" testId={`button-ready-night-${actor.id}`}>استلمت الهاتف، أظهر تعليماتي <Eye size={18} /></Button></div> : hasAbility ? <><div className="mb-4 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4"><div className="text-xs font-semibold text-amber-200">قدرة {role?.name} — القوة {role?.power}</div><p className="mt-1 text-sm leading-6 text-stone-300">{actor.role === 'cupid' && cupidFirstTarget ? `اختر اللاعب الثاني — تم اختيار ${game.players.find((player) => player.id === cupidFirstTarget)?.name}.` : role?.night}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{targetable.filter((target) => target.id !== cupidFirstTarget).map((target) => <button data-testid={`button-target-${target.id}`} key={target.id} onClick={() => actor.role === 'cupid' && cupidFirstTarget ? submitAction(cupidFirstTarget, target.id) : submitAction(target.id)} className="flex min-h-14 items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 text-right text-sm text-stone-200 transition hover:border-amber-300/45 hover:bg-amber-300/[.08]"><span className="flex size-8 items-center justify-center rounded-lg bg-white/8 text-xs text-stone-400">{target.name.slice(0, 1)}</span>{target.name}</button>)}</div>
           <button data-testid={`button-skip-action-${actor.id}`} onClick={() => submitAction()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-stone-500 hover:text-stone-300">لا أستخدم القدرة الليلة <ChevronLeft size={14} /></button></> : <div className="rounded-2xl border border-indigo-200/15 bg-indigo-300/[.05] p-6 text-center"><Users className="mx-auto mb-3 text-indigo-200" size={25} /><div className="text-xs text-indigo-200/70">دورك: {role?.name}</div><h2 className="mt-2 font-serif text-xl text-stone-100">لا توجد قدرة ليلية</h2><p className="mt-2 text-sm leading-6 text-stone-400">{role?.night}</p><Button onClick={onNextPlayer} className="mt-6 min-h-14 w-full" testId={`button-pass-night-${actor.id}`}>أخفي الشاشة ومرّر الهاتف <ChevronLeft size={18} /></Button></div>}
      </div>}
    </div>
  </GameFrame>;
}

function discussionPrompt(game: Game) {
  const living = game.players.filter((player) => player.alive);
  if (!living.length) return { title: 'راجعوا مجرى اللعبة', context: 'لم يبقَ لاعبون أحياء للنقاش.', names: 'الجميع', question: 'ما الملاحظة الأقوى التي قادتكم إلى النتيجة؟', suggestions: ['ما القرار الذي غيّر اتجاه اللعبة؟'] };
  const first = living[game.round % living.length];
  const second = living.length > 3 ? living[(game.round + 2) % living.length] : undefined;
  const names = second && second.id !== first.id ? `${first.name} و${second.name}` : first.name;
  const nightStory = game.dayReport.length
    ? `غاب ${game.dayReport.join('، ')} بعد أحداث الليل. اسألوا أنفسكم: من قد يستفيد من غيابهم؟`
    : game.lastNightInfo?.includes('تعادل')
      ? 'التصويت السابق تعادل؛ لا تجعلوا الحسم يتحول إلى اتهام سريع.'
      : game.lastNightInfo?.includes('الزائر')
        ? 'حدثت محاولة ضربة ولم تسقط ضحية. النجاة ليست دليلاً على البراءة أو الإدانة.'
        : 'لم تسقط ضحية هذه الليلة. قد تكون حماية أو تعطيل قدرة، لذلك لا تساووا بين النجاة والبراءة.';
  const questions = [
    `وجّهوا السؤال إلى ${names}: ما الذي لاحظتموه في أحداث الليلة من دون كشف دور أو ادعاء دليل؟`,
    `اسألوا ${names}: ما الشخص أو القرار الذي يحتاج تفسيراً منطقياً، ولماذا؟`,
    `ناقشوا مع ${names}: هل يوجد أثر يخدم المافيا، أم أنكم تبنون الشك على الصمت فقط؟`,
  ];
  const suggestions = [
    `اختبار اشتباه: اطلبوا من ${first.name} ترتيب أكثر احتمالين عنده وشرح السبب.`,
    second ? `سؤال الدور المهم: اسألوا ${second.name} ماذا كان سيفعل لو كان طبيباً أو محققاً، من دون مطالبته بكشف دوره.` : 'سؤال جوهري: ما المعلومة التي تحتاجونها قبل التصويت؟',
    game.players.some((player) => player.alive && player.silenced) ? 'تنبيه: اللاعب المُسكت لا يستطيع الدفاع عن نفسه؛ لا تجعلوا صمته دليلاً.' : 'تذكير: المافيا قد تختبئ خلف اتهام سهل، وقد يكون الشك في الشخص الخطأ جزءاً من خطتها.',
  ];
  return { title: game.dayReport.length ? 'أثر الليلة' : 'سؤال يفتح الخيط', context: nightStory, names, question: questions[game.round % questions.length], suggestions };
}

function Day({ game, onVoteStart, onNewNight }: { game: Game; onVoteStart: () => void; onNewNight: () => void }) {
  const eliminated = game.dayReport;
  const prompt = useMemo(() => discussionPrompt(game), [game.round, game.players, game.dayReport, game.lastNightInfo]);
  return <GameFrame game={game}><div className="mx-auto max-w-4xl"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300"><Sun size={27} /></div><div className="text-xs font-semibold tracking-[.25em] text-amber-300/70">صباح اليوم {game.round}</div><h1 className="mt-2 font-serif text-4xl font-semibold text-stone-100">من بقي واقفاً؟</h1><p className="mt-2 text-sm text-stone-500">افهموا ما حدث أولاً، ثم ابنوا الشك على كلام وقرار يمكن مناقشته.</p></div>{game.lastNightInfo ? <div className="mb-5 rounded-3xl border border-amber-300/20 bg-amber-300/[.06] p-6 text-center"><Gavel className="mx-auto mb-3 text-amber-300" size={28} /><div className="font-serif text-xl text-amber-100">{game.lastNightInfo}</div><div className="mt-2 text-xs text-stone-500">صوت العمدة يحسم التعادل إن اختار أحد المتعادلين.</div></div> : eliminated.length ? <div className="mb-5 rounded-3xl border border-rose-300/20 bg-rose-300/[.06] p-6 text-center"><Skull className="mx-auto mb-3 text-rose-300" size={28} /><div className="text-xs text-rose-200/60">ما تركه الليل وراءه</div><div data-testid="text-night-report" className="mt-2 font-serif text-2xl text-rose-200">{eliminated.join('، ')}</div><div className="mt-2 text-xs text-stone-500">لا أحد يعرف الدور. إلا صاحبه.</div></div> : <div className="mb-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.06] p-6 text-center"><Shield className="mx-auto mb-3 text-emerald-300" size={28} /><div className="font-serif text-xl text-emerald-200">مرّت الليلة بلا ضحية</div><div className="mt-2 text-xs text-stone-500">لكن الخطر لم ينتهِ؛ الحماية أو التعطيل احتمالان.</div></div>}
        {game.discussionSuggestions !== false && <div className="mb-5 rounded-3xl border border-sky-300/20 bg-sky-300/[.06] p-5 sm:p-6"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200"><MessageCircle size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl text-sky-100">{prompt.title}</h2><span className="rounded-full bg-sky-200/10 px-2 py-1 text-[10px] text-sky-200">اقتراح محادثة فقط</span></div><p className="mt-3 text-xs leading-6 text-sky-100/70">{prompt.context}</p><p data-testid="text-discussion-prompt" className="mt-3 rounded-2xl border border-sky-200/10 bg-black/10 p-3 text-sm leading-7 text-stone-200">وجّهوا السؤال إلى <strong className="text-sky-200">{prompt.names}</strong>: «{prompt.question}»</p><div className="mt-3 grid gap-2">{prompt.suggestions.map((suggestion) => <div key={suggestion} className="rounded-xl border border-white/8 bg-white/[.03] px-3 py-2 text-xs leading-6 text-stone-300">{suggestion}</div>)}</div><p className="mt-3 text-xs leading-6 text-sky-100/60">هذه الشرارة تساعدكم على الكلام عن الليلة الماضية، لكنها ليست دليلاً ولا تكشف دوراً مخفياً. لا تعاقبوا أحداً بسبب الصمت وحده.</p></div></div></div>}
      <div className="rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl font-semibold text-stone-100">اللاعبون الأحياء</h2><span className="text-xs text-stone-500">{game.players.filter((p) => p.alive).length} لاعباً</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{game.players.map((p) => <div data-testid={`status-player-${p.id}`} key={p.id} className={`flex items-center gap-2 rounded-xl border p-3 ${p.alive ? 'border-white/8 bg-black/10' : 'border-rose-300/10 bg-rose-300/[.03] opacity-50'}`}><div className={`flex size-8 items-center justify-center rounded-lg text-xs ${p.alive ? 'bg-amber-300/10 text-amber-200' : 'bg-rose-300/10 text-rose-300'}`}>{p.alive ? <UserRound size={15} /> : <Skull size={14} />}</div><span className={`truncate text-sm ${p.alive ? 'text-stone-200' : 'text-stone-500 line-through'}`}>{p.name}</span>{p.alive && p.silenced && <span className="text-[10px] text-violet-200">مُسكت</span>}</div>)}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Button onClick={onVoteStart} className="flex-1" testId="button-start-voting">ابدأوا النقاش والتصويت <Vote size={18} /></Button><Button onClick={onNewNight} variant="secondary" className="sm:w-auto" testId="button-skip-day">ليلة أخرى <Moon size={17} /></Button></div></div></div></GameFrame>;
}

function Voting({ game, onVote, onResolve }: { game: Game; onVote: (voterId: string, targetId: string) => void; onResolve: () => void }) {
  const alive = game.players.filter((p) => p.alive);
  const allVoted = alive.every((p) => game.votes[p.id]);
  const tally = alive.reduce<Record<string, number>>((acc, p) => { const target = game.votes[p.id]; if (target) acc[target] = (acc[target] || 0) + 1; return acc; }, {});
  return <GameFrame game={game}><div className="mx-auto max-w-4xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-300/10 text-rose-200"><Vote size={27} /></div><div className="text-xs font-semibold tracking-[.25em] text-rose-200/70">جلسة التصويت</div><h1 className="mt-2 font-serif text-3xl font-semibold text-stone-100">من يخرج من المدينة؟</h1><p className="mt-2 text-sm text-stone-500">سجّلوا صوت كل لاعب حي. الأسماء فقط، لا الأدوار.</p></div><div className="grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><h2 className="mb-5 font-serif text-xl text-stone-100">اختيار المتهم</h2><div className="space-y-3">{alive.map((voter) => <div key={voter.id} className="rounded-2xl border border-white/8 bg-black/10 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-stone-200">{voter.name}</span>{game.votes[voter.id] && <Check size={15} className="text-emerald-300" />}</div><div className="flex flex-wrap gap-1.5">{alive.filter((candidate) => candidate.id !== voter.id).map((candidate) => <button data-testid={`button-vote-${voter.id}-${candidate.id}`} key={candidate.id} onClick={() => onVote(voter.id, candidate.id)} className={`rounded-lg px-3 py-2 text-xs transition ${game.votes[voter.id] === candidate.id ? 'bg-rose-300 text-[#26172b]' : 'bg-white/8 text-stone-400 hover:bg-white/15 hover:text-stone-100'}`}>{candidate.name}</button>)}</div></div>)}</div></div><div className="h-fit rounded-3xl border border-white/10 bg-[#211d39] p-5 sm:p-7"><div className="mb-4 flex items-center gap-2 text-amber-300"><Gavel size={18} /><h2 className="font-serif text-xl text-stone-100">صندوق الأصوات</h2></div>{Object.keys(tally).length ? <div className="space-y-3">{Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([id, count]) => <div data-testid={`text-vote-tally-${id}`} key={id} className="flex items-center justify-between rounded-xl bg-black/15 px-3 py-3"><span className="text-sm text-stone-200">{alive.find((p) => p.id === id)?.name}</span><span className="font-serif text-xl text-amber-300">{count}</span></div>)}</div> : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-stone-600">لم تُسجّل أصوات بعد</div>}<Button onClick={onResolve} disabled={!allVoted} className="mt-6 w-full" testId="button-resolve-votes">أعلنوا النتيجة <Gavel size={17} /></Button><p className="mt-3 text-center text-[11px] text-stone-600">{allVoted ? 'كل الأصوات جاهزة للكشف' : `متبقّي ${alive.filter((p) => !game.votes[p.id]).length} أصوات`}</p></div></div></div></GameFrame>;
}

function Result({ game, onReset }: { game: Game; onReset: () => void }) {
  const [guide, setGuide] = useState(false);
  const winner = game.winner;
  return <main className="screen-enter min-h-[100dvh] px-4 py-8 sm:px-8"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between"><Brand /><button data-testid="button-open-role-guide-result" onClick={() => setGuide(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-stone-400 transition hover:text-amber-200"><BookOpen size={15} /> دليل الأدوار</button></header><div className="mt-12 text-center"><div className="pulse-ring mx-auto mb-6 flex size-20 items-center justify-center rounded-[1.7rem] border border-amber-300/30 bg-amber-300/10 text-amber-300">{game.jesterWon ? <Sparkles size={36} /> : winner === 'المافيا' ? <Skull size={36} /> : <Crown size={36} />}</div><div className="text-xs font-semibold tracking-[.3em] text-amber-300/70">انتهت اللعبة</div><h1 data-testid="text-winner" className="mt-3 font-serif text-5xl font-semibold text-stone-50">{game.jesterWon ? 'المهرّج' : winner} يفوز</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-stone-400">{game.jesterWon ? 'أُخرج المهرّج بالتصويت. كان هذا كل ما يريده.' : winner === 'المافيا' ? 'تفوّقت المافيا على المدينة. بعض الأسرار أقوى من الحقيقة.' : 'صمدت المدينة حتى انكشف آخر خيط.'}</p>{game.survivorWon && !game.jesterWon && <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/[.08] px-4 py-2 text-xs text-teal-200"><Shield size={14} /> الناجي بقي حيّاً وحقق هدفه أيضاً.</div>}</div><div className="mt-10 rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-serif text-xl text-stone-100">كشف الستار</h2><span className="text-xs text-stone-500">{game.players.length} أدوار</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{game.players.map((p) => { const role = ROLES[p.role]; return <div data-testid={`card-final-role-${p.id}`} key={p.id} className={`rounded-2xl border p-3 ${p.alive ? 'border-emerald-300/15 bg-emerald-300/[.04]' : 'border-white/8 bg-black/10 opacity-75'}`}><div className="text-sm font-semibold text-stone-200">{p.name}</div><div className="mt-1 text-xs text-amber-300">{role.name} • القوة: {role.power}</div><div className="mt-1 text-[10px] text-stone-600">{role.team} {p.alive ? '• حي' : '• خرج'}</div><p className="mt-2 text-[11px] leading-5 text-stone-500">{role.description}</p></div>; })}</div><div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[.04] p-3 text-xs leading-6 text-rose-100/70"><LockKeyhole className="mt-1 shrink-0" size={14} /> هذه الشاشة تكشف الأدوار. شاركوها فقط بعد انتهاء اللعبة، واحترموا خصوصية كل لاعب.</div></div><div className="mt-7 flex justify-center"><Button onClick={onReset} className="min-h-14 px-8" testId="button-new-game-result">ابدأوا لعبة جديدة <RotateCcw size={18} /></Button></div></div>{guide && <RoleGuide onClose={() => setGuide(false)} />}</main>;
}

function GameApp() {
  const [savedGame, setSavedGame] = useState<Game | null>(() => {
    const loaded = loadSavedGame();
    return loaded?.phase === 'result' ? null : loaded;
  });
  const [game, setGame] = useState<Game | null>(() => {
    const loaded = loadSavedGame();
    return loaded?.phase === 'result' ? loaded : null;
  });
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    // Keep an unfinished saved game available until the player chooses resume
    // or starts a new game; the initial null state must not erase it.
    if (!game && savedGame) return;
    saveGame(game);
  }, [game, savedGame]);
  const reset = () => { setSavedGame(null); setGame(null); setConfirmReset(false); };
  const resume = () => {
    if (!savedGame) return;
    setGame(savedGame);
    setSavedGame(null);
  };
  const start = (names: string[], roleCounts: Partial<Record<RoleKey, number>>, discussionSuggestions: boolean) => { const roleList = Object.entries(roleCounts).flatMap(([role, count]) => Array.from({ length: count || 0 }, () => role as RoleKey)); const shuffledRoles = [...roleList].sort(() => Math.random() - .5); const players = names.map((name, index) => ({ id: uid(), name, role: shuffledRoles[index] || 'civilian', alive: true })); setSavedGame(null); setGame({ players, phase: 'reveal', round: 0, revealIndex: 0, revealed: false, nightActions: [], nightPlayerIndex: 0, dayReport: [], votes: {}, linkedPairs: [], discussionSuggestions }); };
  const update = (fn: (current: Game) => Game) => setGame((current) => current ? fn(current) : current);
  const reveal = () => update((g) => ({ ...g, revealed: true }));
  const nextReveal = () => update((g) => g.revealIndex < g.players.length - 1 ? ({ ...g, revealIndex: g.revealIndex + 1, revealed: false }) : ({ ...g, phase: 'night', round: 1, revealIndex: 0, revealed: false, nightActions: [], nightPlayerIndex: 0, dayReport: [], votes: {} }));
  const nightAction = (actorId: string, targetId?: string, secondaryTargetId?: string) => update((g) => {
    const role = g.players.find((player) => player.id === actorId)?.role || 'civilian';
    const onceRole = ['witch', 'vigilante', 'oracle', 'cupid'].includes(role);
    const linkedPairs = role === 'cupid' && targetId && secondaryTargetId && g.round === 1
      ? [...(g.linkedPairs || []), [targetId, secondaryTargetId] as [string, string]]
      : (g.linkedPairs || []);
    return {
      ...g,
      linkedPairs,
      nightActions: [...g.nightActions, { actorId, role, targetId, secondaryTargetId, skipped: !targetId }],
      players: g.players.map((player) => player.id === actorId && onceRole && targetId ? { ...player, nightUses: (player.nightUses || 0) + 1 } : player),
    };
  });
  const nextNightPlayer = () => update((g) => ({ ...g, nightPlayerIndex: (g.nightPlayerIndex ?? 0) + 1 }));
  const finishNight = () => update((g) => {
    const blockedActorIds = new Set(g.nightActions.filter((action) => action.role === 'saboteur' && action.targetId).map((action) => action.targetId as string));
    const actions = g.nightActions.filter((action) => !blockedActorIds.has(action.actorId));
    const mafia = actions.find((action) => ['mafia', 'godfather', 'mafioso'].includes(action.role) && action.targetId);
    const doctor = actions.find((action) => ['doctor', 'fielddoctor'].includes(action.role) && action.targetId);
    const bodyguard = actions.find((action) => action.role === 'bodyguard' && action.targetId);
    const vigilante = actions.find((action) => action.role === 'vigilante' && action.targetId);
    const victims = [mafia?.targetId, vigilante?.targetId].filter(Boolean) as string[];
    const protectedIds = [doctor?.targetId, bodyguard?.targetId].filter(Boolean) as string[];
    const bodyguardSacrifice = bodyguard?.targetId && victims.includes(bodyguard.targetId) ? bodyguard.actorId : undefined;
    const initialDeaths = [...new Set([...victims.filter((id) => !protectedIds.includes(id)), ...(bodyguardSacrifice ? [bodyguardSacrifice] : [])])];
    const deathIds = new Set(initialDeaths);
    const pendingDeaths = [...initialDeaths];
    while (pendingDeaths.length) {
      const deadId = pendingDeaths.shift();
      if (!deadId) continue;
      for (const pair of g.linkedPairs || []) {
        if (!pair.includes(deadId)) continue;
        const linkedId = pair[0] === deadId ? pair[1] : pair[0];
        if (!deathIds.has(linkedId) && !protectedIds.includes(linkedId)) {
          deathIds.add(linkedId);
          pendingDeaths.push(linkedId);
        }
      }
    }
    const silencedIds = actions.filter((action) => ['witch', 'silencer', 'illusionist'].includes(action.role) && action.targetId).map((action) => action.targetId as string);
    const shieldedIds = new Set<string>();
    const players = g.players.map((player) => {
      if (deathIds.has(player.id) && player.role === 'alien' && !player.alienShieldUsed) {
        shieldedIds.add(player.id);
        return { ...player, alienShieldUsed: true, silenced: false };
      }
      return deathIds.has(player.id) ? { ...player, alive: false, silenced: false } : { ...player, silenced: silencedIds.includes(player.id) };
    });
    const reportIds = players.filter((player) => deathIds.has(player.id) && !player.alive).map((player) => player.id);
    const { winner, survivorWon } = getWinnerState(players);
    const nightInfo = shieldedIds.size ? 'نجا الزائر الغريب من أول ضربة ليلية.' : undefined;
    return winner ? { ...g, players, phase: 'result', winner, survivorWon, dayReport: players.filter((p) => reportIds.includes(p.id)).map((p) => p.name), nightActions: [], nightPlayerIndex: 0, votes: {}, lastNightInfo: nightInfo } : { ...g, players, phase: 'day', dayReport: players.filter((p) => reportIds.includes(p.id)).map((p) => p.name), nightActions: [], nightPlayerIndex: 0, votes: {}, lastNightInfo: nightInfo };
  });
  const startVoting = () => update((g) => ({ ...g, phase: 'voting', votes: {} }));
  const startNight = () => update((g) => ({ ...g, phase: 'night', round: g.round + 1, nightActions: [], nightPlayerIndex: 0, dayReport: [], votes: {}, lastNightInfo: undefined, players: g.players.map((p) => ({ ...p, silenced: false })) }));
  const vote = (voterId: string, targetId: string) => update((g) => ({ ...g, votes: { ...g.votes, [voterId]: targetId } }));
  const resolveVotes = () => update((g) => { const tally: Record<string, number> = {}; Object.values(g.votes).forEach((id) => { tally[id] = (tally[id] || 0) + 1; }); const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]); const topVotes = ranked[0]?.[1] || 0; const tiedIds = ranked.filter(([, count]) => count === topVotes).map(([id]) => id); const mayor = g.players.find((p) => p.alive && p.role === 'mayor'); const mayorChoice = mayor ? g.votes[mayor.id] : undefined; const eliminatedId = tiedIds.length > 1 ? (mayorChoice && tiedIds.includes(mayorChoice) ? mayorChoice : undefined) : tiedIds[0]; const eliminated = g.players.find((p) => p.id === eliminatedId); const players = eliminated ? g.players.map((p) => p.id === eliminatedId ? { ...p, alive: false } : p) : g.players; const jesterWon = eliminated?.role === 'jester'; const { winner: teamWinner, survivorWon } = getWinnerState(players); const winner: Team | undefined = jesterWon ? 'مستقل' : teamWinner; const tieNotice = !eliminated && tiedIds.length > 1 ? (mayor ? 'تعادل في الأصوات — استخدموا صوت العمدة للحسم في الجولة التالية.' : 'تعادل في الأصوات — لا أحد يخرج الليلة.') : undefined; return winner ? { ...g, players, phase: 'result', winner, survivorWon: !jesterWon && survivorWon, jesterWon } : { ...g, players, phase: 'day', dayReport: eliminated ? [eliminated.name] : [], votes: {}, round: g.round, lastNightInfo: tieNotice }; });
  const content = !game ? <Setup onStart={start} savedGame={savedGame} onResume={resume} onReset={reset} /> : game.phase === 'reveal' ? <Reveal game={game} onReveal={reveal} onNext={nextReveal} /> : game.phase === 'night' ? <Night game={game} onAction={nightAction} onNextPlayer={nextNightPlayer} onFinish={finishNight} /> : game.phase === 'day' ? <Day game={game} onVoteStart={startVoting} onNewNight={startNight} /> : game.phase === 'voting' ? <Voting game={game} onVote={vote} onResolve={resolveVotes} /> : <Result game={game} onReset={reset} />;
  return <AppShell>{content}{game && game.phase !== 'result' && <button data-testid="button-safe-reset" onClick={() => setConfirmReset(true)} aria-label="إعادة ضبط اللعبة" className="fixed bottom-4 left-4 z-10 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#211d39]/90 text-stone-500 backdrop-blur transition hover:text-rose-300" title="إعادة ضبط اللعبة"><RotateCcw size={16} /></button>}{confirmReset && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090812]/80 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#211d39] p-6 text-center shadow-2xl"><div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300"><Trash2 size={22} /></div><h2 className="font-serif text-xl font-semibold text-stone-100">إيقاف اللعبة؟</h2><p className="mt-2 text-sm leading-6 text-stone-500">سيُحذف التقدم المحفوظ من هذا الهاتف.</p><div className="mt-6 flex gap-2"><Button onClick={() => setConfirmReset(false)} variant="secondary" className="flex-1" testId="button-cancel-reset">أكمل اللعبة</Button><Button onClick={reset} variant="danger" className="flex-1" testId="button-confirm-reset">نعم، ابدأ من جديد</Button></div></div></div>}</AppShell>;
}

function Router() {
  return <ErrorBoundary resetKey={location.pathname}><Switch><Route path="/" component={GameApp} /><Route component={() => <div className="flex min-h-[100dvh] items-center justify-center text-stone-300">الصفحة غير موجودة</div>} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;