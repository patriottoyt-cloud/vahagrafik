import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, CalendarDays, Settings2, CheckCircle2, AlertTriangle, User,
  ShieldCheck, Plus, X, ChevronLeft, Save, RefreshCw, Clock, Trash2,
  ArrowLeft, Wand2, PenLine, Info
} from 'lucide-react';
import { storageGet, storageSet, storageList } from './storage';

/* ---------- brand tokens (Ваха Лавка) ---------- */
const BRAND = {
  cream: '#FAF6EF',
  creamDeep: '#F1E9DC',
  terracotta: '#B74332',
  terracottaDeep: '#8F3226',
  ink: '#1A100A',
  inkSoft: '#5B4A40',
  gold: '#B8934A',
  sage: '#6B7A5E',
  rust: '#A13327',
  line: '#E4D9C8',
};

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Raleway:wght@400;500;600;700&display=swap');
html{ -webkit-text-size-adjust:100%; }
.vaha-root{
  font-family:'Raleway',ui-sans-serif,system-ui,sans-serif; background:${BRAND.cream}; color:${BRAND.ink};
  overflow-x:hidden; width:100%;
  -webkit-tap-highlight-color: transparent;
}
.vaha-root, .vaha-root *{ touch-action:manipulation; }
.vaha-display{ font-family:'Cormorant Garamond',Georgia,serif; }
.vaha-card{ background:#fff; border:1px solid ${BRAND.line}; border-radius:14px; }
.vaha-btn-primary{ background:${BRAND.terracotta}; color:#fff; border:none; }
.vaha-btn-primary:hover{ background:${BRAND.terracottaDeep}; }
.vaha-btn-primary:disabled{ background:#D9CBBE; color:#fff; cursor:not-allowed; }
.vaha-btn-ghost{ background:transparent; color:${BRAND.ink}; border:1px solid ${BRAND.line}; }
.vaha-btn-ghost:hover{ background:${BRAND.creamDeep}; }
.vaha-chip{ border:1px solid ${BRAND.line}; background:#fff; color:${BRAND.inkSoft}; min-height:40px; display:inline-flex; align-items:center; }
.vaha-chip.active{ background:${BRAND.terracotta}; border-color:${BRAND.terracotta}; color:#fff; }
.vaha-chip.off.active{ background:${BRAND.inkSoft}; border-color:${BRAND.inkSoft}; color:#fff; }
.vaha-chip.flex.active{ background:${BRAND.gold}; border-color:${BRAND.gold}; color:#fff; }
.vaha-scroll::-webkit-scrollbar{ height:6px; width:6px; }
.vaha-scroll::-webkit-scrollbar-thumb{ background:${BRAND.line}; border-radius:4px; }
.vaha-topbar{ position:sticky; top:0; z-index:20; background:${BRAND.cream}; padding-top:10px; padding-bottom:10px; }
.vaha-bottombar{ padding-bottom: calc(16px + env(safe-area-inset-bottom)); }
button{ min-height:40px; }
input[type=text], input[type=number], input[type=date], select, textarea{
  border:1px solid ${BRAND.line}; border-radius:8px; padding:8px 10px; background:#fff; color:${BRAND.ink};
  font-size:16px; min-height:40px;
}
@media (min-width:640px){
  input[type=text], input[type=number], input[type=date], select, textarea{ font-size:14px; }
}
input:focus, select:focus, textarea:focus, button:focus-visible{
  outline:2px solid ${BRAND.gold}; outline-offset:1px;
}
`;

/* ---------- date helpers ---------- */
const RU_WD_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const RU_WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Pure calendar-date arithmetic done entirely in UTC so it never depends on
// the visitor's local timezone (a local-time Date + toISOString() round-trip
// silently "sticks" on the same day for UTC+ timezones).
function addDaysStr(d, n) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function weekdayOf(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}
function fmtDate(d, withWeekday = true) {
  const [, m, day] = d.split('-').map(Number);
  const w = weekdayOf(d);
  return withWeekday ? `${parseInt(day, 10)} ${RU_MONTHS[m - 1]}, ${RU_WD_short_cap(w)}` : `${parseInt(day, 10)} ${RU_MONTHS[m - 1]}`;
}
function RU_WD_short_cap(w) { return RU_WD_SHORT[w]; }
function enumerateDates(start, end) {
  if (!start || !end || start > end) return [];
  const dates = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 120) {
    dates.push(cur);
    cur = addDaysStr(cur, 1);
    guard++;
  }
  return dates;
}
function periodKey(period) {
  return `${period.start}_${period.end}`;
}

/* ---------- defaults ---------- */
const DEFAULT_ROSTER = ['Валерия', 'Роман', 'Лиза', 'Дмитрий', 'Полина', 'Виталина', 'Наташа', 'Павел', 'Вика', 'Глеб', 'Соня'];

const DEFAULT_REQUIREMENTS = {
  0: [{ time: '10:00', count: 2 }, { time: '12:00', count: 3 }], // вс
  1: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }], // пн
  2: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }], // вт
  3: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }], // ср
  4: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }], // чт
  5: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }, { time: '14:00', count: 2 }], // пт
  6: [{ time: '10:00', count: 2 }, { time: '12:00', count: 2 }, { time: '14:00', count: 2 }], // сб
};

function defaultPeriod() {
  const start = addDaysStr(todayStr(), 1);
  const end = addDaysStr(start, 7);
  return { start, end };
}

/* ---------- scheduling algorithm ---------- */
function buildSchedule(period, requirements, prefsByWaiter, roster) {
  const dates = enumerateDates(period.start, period.end);
  const schedule = {};
  const issues = [];
  const lastShift = {};
  const shiftCount = {};
  roster.forEach((n) => (shiftCount[n] = 0));

  for (const date of dates) {
    const weekday = weekdayOf(date);
    const slots = requirements[weekday] || [];
    schedule[date] = {};
    const assignedToday = new Set();
    const prevDate = addDaysStr(date, -1);

    const restOk = (name) => {
      const prev = lastShift[name];
      return !(prev && prev.date === prevDate && prev.time !== '10:00');
    };

    for (const slot of slots) {
      const need = slot.count;

      // Pass 1: people who asked for this day with a matching (or "any") time.
      let candidates = roster.filter((name) => {
        const p = prefsByWaiter[name] && prefsByWaiter[name][date];
        if (!p || p.status !== 'work') return false;
        if (assignedToday.has(name)) return false;
        if (p.times && p.times.length > 0 && !p.times.includes(slot.time)) return false;
        if (slot.time === '10:00' && !restOk(name)) return false;
        return true;
      });

      candidates.sort((a, b) => {
        const pa = prefsByWaiter[a][date];
        const pb = prefsByWaiter[b][date];
        if (!!pa.mustHave !== !!pb.mustHave) return pa.mustHave ? -1 : 1;
        return (shiftCount[a] || 0) - (shiftCount[b] || 0);
      });

      const chosen = candidates.slice(0, need);
      const overflow = candidates.slice(need);
      const flexUsed = [];

      chosen.forEach((n) => {
        assignedToday.add(n);
        shiftCount[n] = (shiftCount[n] || 0) + 1;
        lastShift[n] = { date, time: slot.time };
      });

      // Pass 2: "На ваше усмотрение" fills whatever is still short — fair
      // (fewest shifts so far) with a random tiebreak among equals.
      let stillShort = need - chosen.length;
      if (stillShort > 0) {
        let flexCandidates = roster.filter((name) => {
          const p = prefsByWaiter[name] && prefsByWaiter[name][date];
          if (!p || p.status !== 'flexible') return false;
          if (assignedToday.has(name)) return false;
          if (slot.time === '10:00' && !restOk(name)) return false;
          return true;
        });
        flexCandidates = flexCandidates
          .map((n) => ({ n, score: (shiftCount[n] || 0) + Math.random() }))
          .sort((a, b) => a.score - b.score)
          .map((x) => x.n);

        const flexChosen = flexCandidates.slice(0, stillShort);
        flexChosen.forEach((n) => {
          assignedToday.add(n);
          shiftCount[n] = (shiftCount[n] || 0) + 1;
          lastShift[n] = { date, time: slot.time };
          chosen.push(n);
          flexUsed.push(n);
        });
        stillShort -= flexChosen.length;
      }

      schedule[date][slot.time] = chosen;
      schedule[date][`${slot.time}__flex`] = flexUsed;

      if (stillShort > 0) {
        issues.push({
          type: 'shortage',
          date,
          time: slot.time,
          missing: stillShort,
        });
      }
    }

    // Which slots on this date still have open seats (after both fill passes)?
    const shortfallSlots = slots.filter((slot) => (schedule[date][slot.time] || []).length < slot.count);

    // Anyone who explicitly wanted to work this day but didn't get placed —
    // paired with a concrete alternative time if one still has room, so it's
    // a real ask ("come at 10:00 instead") rather than just a complaint.
    roster.forEach((name) => {
      const p = prefsByWaiter[name] && prefsByWaiter[name][date];
      if (!p || p.status !== 'work' || assignedToday.has(name)) return;
      const restOkHere = (time) => !(time === '10:00' && !restOk(name));
      const suggestions = shortfallSlots.filter((slot) => restOkHere(slot.time)).map((slot) => slot.time);
      issues.push({
        type: 'conflict',
        date,
        name,
        wanted: p.times && p.times.length ? p.times.join(', ') : 'любое время',
        mustHave: !!p.mustHave,
        note: p.note || '',
        suggestions,
      });
    });
  }

  return { schedule, issues };
}

/* ---------- small UI atoms ---------- */
function Btn({ children, onClick, variant = 'primary', className = '', disabled, type = 'button', title }) {
  const cls = variant === 'primary' ? 'vaha-btn-primary' : 'vaha-btn-ghost';
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${cls} px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children, tone = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`vaha-chip ${tone === 'off' ? 'off' : ''} ${tone === 'flex' ? 'flex' : ''} ${active ? 'active' : ''} px-3 py-1.5 rounded-full text-sm font-medium transition-colors`}
    >
      {children}
    </button>
  );
}

/* ================= ROLE SELECT ================= */
function RoleSelect({ onPick }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 text-xs tracking-[0.3em] uppercase" style={{ color: BRAND.gold }}>Ваха Лавка</div>
      <h1 className="vaha-display text-4xl sm:text-5xl font-semibold mb-3" style={{ color: BRAND.ink }}>
        График смен
      </h1>
      <p className="max-w-sm mb-10" style={{ color: BRAND.inkSoft }}>
        Официанты отмечают, когда хотят работать. Администратор собирает график и видит, где не хватает людей.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => onPick('waiter')}
          className="vaha-card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: BRAND.creamDeep }}>
            <User size={22} color={BRAND.terracotta} />
          </div>
          <div className="font-semibold">Я официант</div>
          <div className="text-xs" style={{ color: BRAND.inkSoft }}>Указать дни и время</div>
        </button>
        <button
          onClick={() => onPick('admin')}
          className="vaha-card p-6 flex flex-col items-center gap-3 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: BRAND.creamDeep }}>
            <ShieldCheck size={22} color={BRAND.terracotta} />
          </div>
          <div className="font-semibold">Я администратор</div>
          <div className="text-xs" style={{ color: BRAND.inkSoft }}>Настроить и собрать график</div>
        </button>
      </div>
    </div>
  );
}

/* ================= WAITER VIEW ================= */
function WaiterView({ onBack }) {
  const [roster, setRoster] = useState(DEFAULT_ROSTER);
  const [period, setPeriod] = useState(null);
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await storageGet('roster');
      const p = await storageGet('period');
      const req = await storageGet('requirements');
      if (r) setRoster(r);
      if (p) setPeriod(p);
      if (req) setRequirements(req);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!name || !period) return;
    (async () => {
      const key = `prefs:${periodKey(period)}:${name}`;
      const saved = await storageGet(key);
      setPrefs(saved || {});
    })();
  }, [name, period]);

  const dates = useMemo(() => (period ? enumerateDates(period.start, period.end) : []), [period]);

  const setDay = (date, patch) => {
    setPrefs((prev) => ({
      ...prev,
      [date]: { ...(prev[date] || { status: 'off', times: [], mustHave: false, note: '' }), ...patch },
    }));
  };

  const toggleTime = (date, time) => {
    setPrefs((prev) => {
      const cur = prev[date] || { status: 'work', times: [], mustHave: false, note: '' };
      const times = cur.times.includes(time) ? cur.times.filter((t) => t !== time) : [...cur.times, time];
      return { ...prev, [date]: { ...cur, status: 'work', times } };
    });
  };

  const addSelf = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const next = roster.includes(trimmed) ? roster : [...roster, trimmed];
    setRoster(next);
    await storageSet('roster', next);
    setName(trimmed);
    setNewName('');
  };

  const save = async () => {
    if (!name || !period) return;
    setSaving(true);
    const key = `prefs:${periodKey(period)}:${name}`;
    await storageSet(key, prefs);
    setSaving(false);
    setSavedAt(new Date());
  };

  if (loading) {
    return <CenterNote text="Загрузка…" />;
  }

  if (!period) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <Info className="mx-auto mb-3" color={BRAND.gold} />
        <p style={{ color: BRAND.inkSoft }}>Администратор ещё не задал период графика. Загляните позже.</p>
        <Btn variant="ghost" className="mt-6" onClick={onBack}><ArrowLeft size={16} />Назад</Btn>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-28">
      <TopBar onBack={onBack} title="Я официант" />

      {!name ? (
        <div className="vaha-card p-5 mt-4">
          <div className="text-sm mb-3" style={{ color: BRAND.inkSoft }}>Выберите своё имя</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {roster.map((r) => (
              <Chip key={r} active={false} onClick={() => setName(r)}>{r}</Chip>
            ))}
          </div>
          <div className="text-xs mb-2" style={{ color: BRAND.inkSoft }}>Не нашли себя в списке?</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ваше имя"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Btn onClick={addSelf}><Plus size={16} />Добавить</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mt-4 mb-1">
            <div className="vaha-display text-2xl font-semibold">{name}</div>
            <button className="text-xs underline" style={{ color: BRAND.inkSoft }} onClick={() => setName('')}>сменить</button>
          </div>
          <p className="text-xs mb-4" style={{ color: BRAND.inkSoft }}>
            Период: {fmtDate(period.start, false)} – {fmtDate(period.end, false)}. Отметьте каждый день.
          </p>

          <div className="space-y-3">
            {dates.map((date) => {
              const weekday = weekdayOf(date);
              const slots = requirements[weekday] || [];
              const day = prefs[date] || { status: null, times: [], mustHave: false, note: '' };
              const isOff = day.status === 'off';
              const isWork = day.status === 'work';
              const isFlexible = day.status === 'flexible';
              return (
                <div key={date} className="vaha-card p-4">
                  <div className="font-semibold capitalize mb-2">{fmtDate(date)}</div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Chip tone="off" active={isOff} onClick={() => setDay(date, { status: 'off', times: [] })}>Не могу</Chip>
                    <Chip active={isWork} onClick={() => setDay(date, { status: 'work' })}>Хочу работать</Chip>
                    <Chip tone="flex" active={isFlexible} onClick={() => setDay(date, { status: 'flexible', times: [] })}>На ваше усмотрение</Chip>
                  </div>
                  {isWork && (
                    <div>
                      <div className="text-xs mb-2" style={{ color: BRAND.inkSoft }}>Во сколько удобно? (можно не выбирать — любое время)</div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {slots.map((s) => (
                          <Chip key={s.time} active={day.times && day.times.includes(s.time)} onClick={() => toggleTime(date, s.time)}>
                            <Clock size={13} className="inline mr-1 -mt-0.5" />{s.time}
                          </Chip>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-sm mb-2" style={{ color: BRAND.inkSoft }}>
                        <input
                          type="checkbox"
                          checked={!!day.mustHave}
                          onChange={(e) => setDay(date, { mustHave: e.target.checked })}
                        />
                        Обязательно нужна эта смена
                      </label>
                      <input
                        type="text"
                        placeholder="Комментарий (необязательно)"
                        value={day.note || ''}
                        onChange={(e) => setDay(date, { note: e.target.value })}
                        className="w-full text-sm"
                      />
                    </div>
                  )}
                  {isFlexible && (
                    <div>
                      <div className="text-xs mb-2" style={{ color: BRAND.inkSoft }}>
                        Вас поставят туда, где не хватает людей — время выберет админ.
                      </div>
                      <input
                        type="text"
                        placeholder="Комментарий (необязательно)"
                        value={day.note || ''}
                        onChange={(e) => setDay(date, { note: e.target.value })}
                        className="w-full text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="vaha-bottombar fixed bottom-0 left-0 right-0 p-4 pt-6" style={{ background: `linear-gradient(to top, ${BRAND.cream} 65%, transparent)` }}>
            <div className="max-w-md mx-auto flex items-center gap-3">
              <Btn className="flex-1 justify-center" onClick={save} disabled={saving}>
                <Save size={16} />{saving ? 'Сохраняю…' : 'Сохранить пожелания'}
              </Btn>
            </div>
            {savedAt && (
              <div className="text-center text-xs mt-2" style={{ color: BRAND.sage }}>
                Сохранено в {savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================= ADMIN VIEW ================= */
function AdminView({ onBack }) {
  const [tab, setTab] = useState('settings'); // settings | submissions | schedule
  const [roster, setRoster] = useState(DEFAULT_ROSTER);
  const [period, setPeriod] = useState(defaultPeriod());
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [prefsByWaiter, setPrefsByWaiter] = useState({});
  const [result, setResult] = useState(null); // {schedule, issues}
  const [building, setBuilding] = useState(false);
  const [editableSchedule, setEditableSchedule] = useState(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await storageGet('roster');
      const p = await storageGet('period');
      const req = await storageGet('requirements');
      if (r) setRoster(r);
      if (p) setPeriod(p);
      if (req) setRequirements(req);
      setLoading(false);
    })();
  }, []);

  const saveConfig = async (nextRoster, nextPeriod, nextReq) => {
    setSavingConfig(true);
    await storageSet('roster', nextRoster);
    await storageSet('period', nextPeriod);
    await storageSet('requirements', nextReq);
    setSavingConfig(false);
  };

  const loadSubmissions = useCallback(async () => {
    const keys = await storageList(`prefs:${periodKey(period)}:`);
    const map = {};
    for (const k of keys) {
      const v = await storageGet(k);
      const name = k.split(':').slice(2).join(':');
      if (v) map[name] = v;
    }
    setPrefsByWaiter(map);
    return map;
  }, [period]);

  useEffect(() => {
    if (!loading) loadSubmissions();
  }, [loading, tab, loadSubmissions]);

  const runBuild = async () => {
    setBuilding(true);
    const map = await loadSubmissions();
    const res = buildSchedule(period, requirements, map, roster);
    setResult(res);
    setEditableSchedule(res.schedule);
    setBuilding(false);
    setTab('schedule');
  };

  const saveFinalSchedule = async () => {
    setSavingSchedule(true);
    await storageSet(`schedule:${periodKey(period)}`, editableSchedule);
    setSavingSchedule(false);
  };

  const dates = useMemo(() => enumerateDates(period.start, period.end), [period]);
  const submittedCount = Object.keys(prefsByWaiter).length;

  if (loading) return <CenterNote text="Загрузка…" />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-16">
      <TopBar onBack={onBack} title="Администратор" />

      <div className="flex gap-2 mt-4 mb-6 overflow-x-auto vaha-scroll">
        <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings2 size={15} />}>Настройки</TabBtn>
        <TabBtn active={tab === 'submissions'} onClick={() => setTab('submissions')} icon={<Users size={15} />}>
          Пожелания {submittedCount > 0 && <span className="ml-1 opacity-70">({submittedCount})</span>}
        </TabBtn>
        <TabBtn active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={<CalendarDays size={15} />}>График</TabBtn>
      </div>

      {tab === 'settings' && (
        <SettingsTab
          roster={roster}
          setRoster={setRoster}
          period={period}
          setPeriod={setPeriod}
          requirements={requirements}
          setRequirements={setRequirements}
          onSave={saveConfig}
          saving={savingConfig}
        />
      )}

      {tab === 'submissions' && (
        <SubmissionsTab
          roster={roster}
          period={period}
          dates={dates}
          prefsByWaiter={prefsByWaiter}
          onRefresh={loadSubmissions}
        />
      )}

      {tab === 'schedule' && (
        <ScheduleTab
          period={period}
          dates={dates}
          requirements={requirements}
          roster={roster}
          result={result}
          onBuild={runBuild}
          building={building}
          editableSchedule={editableSchedule}
          setEditableSchedule={setEditableSchedule}
          onSaveFinal={saveFinalSchedule}
          savingSchedule={savingSchedule}
          prefsByWaiter={prefsByWaiter}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-colors"
      style={active ? { background: BRAND.terracotta, color: '#fff' } : { background: '#fff', color: BRAND.inkSoft, border: `1px solid ${BRAND.line}` }}
    >
      {icon}{children}
    </button>
  );
}

function TopBar({ onBack, title }) {
  return (
    <div className="vaha-topbar flex items-center justify-between">
      <button onClick={onBack} className="text-sm inline-flex items-center gap-1" style={{ color: BRAND.inkSoft }}>
        <ChevronLeft size={16} /> Ваха Лавка
      </button>
      <div className="text-xs font-semibold tracking-wide uppercase" style={{ color: BRAND.gold }}>{title}</div>
    </div>
  );
}

function CenterNote({ text }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" style={{ color: BRAND.inkSoft }}>
      <RefreshCw className="animate-spin mr-2" size={16} />{text}
    </div>
  );
}

/* ---------- Settings tab ---------- */
function SettingsTab({ roster, setRoster, period, setPeriod, requirements, setRequirements, onSave, saving }) {
  const [newName, setNewName] = useState('');
  const dirty = true;

  const removeName = (n) => setRoster(roster.filter((r) => r !== n));
  const addName = () => {
    const t = newName.trim();
    if (t && !roster.includes(t)) setRoster([...roster, t]);
    setNewName('');
  };

  const updateSlot = (weekday, idx, patch) => {
    setRequirements((prev) => {
      const arr = [...(prev[weekday] || [])];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [weekday]: arr };
    });
  };
  const addSlot = (weekday) => {
    setRequirements((prev) => ({ ...prev, [weekday]: [...(prev[weekday] || []), { time: '10:00', count: 1 }] }));
  };
  const removeSlot = (weekday, idx) => {
    setRequirements((prev) => ({ ...prev, [weekday]: prev[weekday].filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6">
      <div className="vaha-card p-5">
        <div className="font-semibold mb-3 vaha-display text-xl">Период графика</div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm flex items-center gap-2" style={{ color: BRAND.inkSoft }}>
            С
            <input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </label>
          <label className="text-sm flex items-center gap-2" style={{ color: BRAND.inkSoft }}>
            По
            <input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="vaha-card p-5">
        <div className="font-semibold mb-3 vaha-display text-xl">Состав официантов</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {roster.map((n) => (
            <span key={n} className="vaha-chip px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2">
              {n}
              <button onClick={() => removeName(n)} aria-label={`Убрать ${n}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Новый официант" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
          <Btn variant="ghost" onClick={addName}><Plus size={15} />Добавить</Btn>
        </div>
      </div>

      <div className="vaha-card p-5">
        <div className="font-semibold mb-1 vaha-display text-xl">Нужно человек по дням недели</div>
        <p className="text-xs mb-4" style={{ color: BRAND.inkSoft }}>Для каждого дня недели — время начала смены и сколько человек нужно.</p>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <div key={wd} className="pb-4" style={{ borderBottom: `1px solid ${BRAND.line}` }}>
              <div className="text-sm font-semibold capitalize mb-2">{RU_WD_FULL[wd]}</div>
              <div className="space-y-2">
                {(requirements[wd] || []).map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slot.time}
                      onChange={(e) => updateSlot(wd, idx, { time: e.target.value })}
                      className="w-20 text-sm"
                    />
                    <span className="text-xs" style={{ color: BRAND.inkSoft }}>×</span>
                    <input
                      type="number"
                      min={0}
                      value={slot.count}
                      onChange={(e) => updateSlot(wd, idx, { count: parseInt(e.target.value || '0', 10) })}
                      className="w-16 text-sm"
                    />
                    <span className="text-xs" style={{ color: BRAND.inkSoft }}>чел.</span>
                    <button onClick={() => removeSlot(wd, idx)} className="ml-auto" style={{ color: BRAND.rust }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addSlot(wd)} className="text-xs inline-flex items-center gap-1" style={{ color: BRAND.terracotta }}>
                  <Plus size={13} /> добавить смену
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PasswordCard />

      <Btn onClick={() => onSave(roster, period, requirements)} disabled={saving} className="w-full justify-center">
        <Save size={16} />{saving ? 'Сохраняю…' : 'Сохранить настройки'}
      </Btn>
      <p className="text-xs text-center" style={{ color: BRAND.inkSoft }}>
        Настройки видны всем, кто открывает эту ссылку — включая официантов.
      </p>
    </div>
  );
}

function PasswordCard() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (value.trim().length < 4) return;
    setSaving(true);
    await storageSet('admin_pin', value.trim());
    setSaving(false);
    setSaved(true);
    setValue('');
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="vaha-card p-5">
      <div className="font-semibold mb-1 vaha-display text-xl">Пароль администратора</div>
      <p className="text-xs mb-3" style={{ color: BRAND.inkSoft }}>Этот пароль спрашивается при входе в раздел «Администратор».</p>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder="новый пароль"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <Btn variant="ghost" onClick={save} disabled={saving || value.trim().length < 4}>
          <Save size={15} />Сохранить
        </Btn>
      </div>
      {saved && <div className="text-xs mt-2" style={{ color: BRAND.sage }}>Пароль обновлён</div>}
    </div>
  );
}

/* ---------- Submissions tab ---------- */
function SubmissionsTab({ roster, period, dates, prefsByWaiter, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: BRAND.inkSoft }}>
          Период {fmtDate(period.start, false)} – {fmtDate(period.end, false)}
        </p>
        <button onClick={refresh} className="text-xs inline-flex items-center gap-1" style={{ color: BRAND.terracotta }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> обновить
        </button>
      </div>

      {roster.length === 0 && <p style={{ color: BRAND.inkSoft }}>Список официантов пуст.</p>}

      <div className="space-y-3">
        {roster.map((name) => {
          const p = prefsByWaiter[name];
          const filled = p ? Object.keys(p).length : 0;
          return (
            <div key={name} className="vaha-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{name}</div>
                {p ? (
                  <span className="text-xs inline-flex items-center gap-1" style={{ color: BRAND.sage }}>
                    <CheckCircle2 size={13} /> {filled} из {dates.length} дней
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: BRAND.rust }}>нет ответа</span>
                )}
              </div>
              {p && (
                <div className="flex flex-wrap gap-1.5">
                  {dates.map((d) => {
                    const day = p[d];
                    if (!day) return (
                      <span key={d} className="text-[11px] px-2 py-1 rounded" style={{ background: BRAND.creamDeep, color: BRAND.inkSoft }}>
                        {fmtDate(d, false)}: ?
                      </span>
                    );
                    const label = day.status === 'off'
                      ? 'выходной'
                      : day.status === 'flexible'
                        ? 'на усмотрение'
                        : (day.times && day.times.length ? day.times.join(',') : 'любое время');
                    const style = day.status === 'off'
                      ? { background: BRAND.creamDeep, color: BRAND.inkSoft }
                      : day.status === 'flexible'
                        ? { background: '#F1E6C8', color: '#8A6A1E' }
                        : { background: '#F3E4DD', color: BRAND.terracottaDeep };
                    return (
                      <span key={d} className="text-[11px] px-2 py-1 rounded" style={style}>
                        {fmtDate(d, false)}: {label}{day.mustHave ? ' •важно' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Schedule tab ---------- */
function ScheduleTab({ period, dates, requirements, roster, result, onBuild, building, editableSchedule, setEditableSchedule, onSaveFinal, savingSchedule, prefsByWaiter }) {
  const issues = result ? result.issues : [];
  const issuesByDate = useMemo(() => {
    const map = {};
    issues.forEach((i) => {
      (map[i.date] = map[i.date] || []).push(i);
    });
    return map;
  }, [issues]);
  const issueDates = Object.keys(issuesByDate).sort();

  const setCellPerson = (date, time, idx, newName) => {
    setEditableSchedule((prev) => {
      const next = { ...prev };
      const arr = [...(next[date][time] || [])];
      if (newName === '') arr.splice(idx, 1);
      else arr[idx] = newName;
      next[date] = { ...next[date], [time]: arr };
      return next;
    });
  };
  const addCellPerson = (date, time) => {
    setEditableSchedule((prev) => {
      const next = { ...prev };
      const arr = [...(next[date][time] || []), ''];
      next[date] = { ...next[date], [time]: arr };
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm" style={{ color: BRAND.inkSoft }}>
          Период {fmtDate(period.start, false)} – {fmtDate(period.end, false)}
        </p>
        <Btn onClick={onBuild} disabled={building}>
          <Wand2 size={15} />{building ? 'Собираю…' : 'Собрать график'}
        </Btn>
      </div>

      {!result && (
        <div className="vaha-card p-6 text-center" style={{ color: BRAND.inkSoft }}>
          Нажмите «Собрать график» — соберём его из пожеланий официантов.
        </div>
      )}

      {result && (
        <>
          {issueDates.length > 0 && (
            <div className="mb-5">
              <div className="font-semibold mb-3 inline-flex items-center gap-2" style={{ color: BRAND.rust }}>
                <AlertTriangle size={16} /> Нужно решить лично — {issueDates.length} {issueDates.length === 1 ? 'день' : 'дней'}
              </div>
              <div className="space-y-3">
                {issueDates.map((date) => {
                  const dayIssues = issuesByDate[date];
                  const shortages = dayIssues.filter((i) => i.type === 'shortage');
                  const conflicts = dayIssues.filter((i) => i.type === 'conflict');
                  return (
                    <div key={date} className="vaha-card p-4" style={{ borderColor: '#E3B3A8' }}>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="font-semibold capitalize">{fmtDate(date)}</div>
                        <div className="flex gap-1.5 flex-wrap">
                          {shortages.map((s, k) => (
                            <span
                              key={k}
                              className="text-[11px] px-2 py-1 rounded-full font-medium"
                              style={{ background: '#F3E4DD', color: BRAND.rust }}
                            >
                              не хватает {s.missing} на {s.time}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        {conflicts.map((c, k) => (
                          <div key={k}>
                            <b style={{ color: BRAND.ink }}>{c.name}</b>
                            {c.mustHave && <span style={{ color: BRAND.rust }}> ⚠ обязательно</span>}
                            <span style={{ color: BRAND.inkSoft }}> хотел(а) {c.wanted}</span>
                            {c.suggestions.length > 0 ? (
                              <span style={{ color: BRAND.inkSoft }}>
                                {' '}— свободно на <b style={{ color: BRAND.sage }}>{c.suggestions.join(', ')}</b>, можно предложить
                              </span>
                            ) : (
                              <span style={{ color: BRAND.inkSoft }}> — свободных мест в этот день больше нет</span>
                            )}
                            {c.note && <span style={{ color: BRAND.inkSoft }}> («{c.note}»)</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] mb-1 sm:hidden" style={{ color: BRAND.inkSoft }}>← прокрутите таблицу вправо, чтобы увидеть все смены →</p>
          <div className="vaha-card overflow-x-auto vaha-scroll">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr style={{ background: BRAND.creamDeep }}>
                  <th className="text-left p-2 font-semibold" style={{ minWidth: 110 }}>Дата</th>
                  {Array.from(new Set(dates.flatMap((d) => (requirements[weekdayOf(d)] || []).map((s) => s.time)))).sort().map((t) => (
                    <th key={t} className="text-left p-2 font-semibold">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const weekday = weekdayOf(date);
                  const slots = requirements[weekday] || [];
                  const slotTimes = slots.map((s) => s.time);
                  const allTimes = Array.from(new Set(dates.flatMap((d) => (requirements[weekdayOf(d)] || []).map((s) => s.time)))).sort();
                  return (
                    <tr key={date} style={{ borderTop: `1px solid ${BRAND.line}` }}>
                      <td className="p-2 align-top">
                        <div className="font-medium capitalize">{fmtDate(date)}</div>
                      </td>
                      {allTimes.map((t) => {
                        if (!slotTimes.includes(t)) return <td key={t} className="p-2 align-top text-center" style={{ color: BRAND.line }}>—</td>;
                        const names = (editableSchedule[date] && editableSchedule[date][t]) || [];
                        const flexSet = new Set((editableSchedule[date] && editableSchedule[date][`${t}__flex`]) || []);
                        return (
                          <td key={t} className="p-2 align-top">
                            <div className="space-y-1">
                              {names.map((n, idx) => (
                                <div key={idx}>
                                  <select
                                    value={n}
                                    onChange={(e) => setCellPerson(date, t, idx, e.target.value)}
                                    className="text-xs w-full"
                                  >
                                    <option value="">— убрать —</option>
                                    {roster.map((r) => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                  </select>
                                  {n && flexSet.has(n) && (
                                    <div className="text-[10px] mt-0.5" style={{ color: BRAND.gold }}>✦ по усмотрению</div>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => addCellPerson(date, t)}
                                className="text-[11px] inline-flex items-center gap-1"
                                style={{ color: BRAND.terracotta }}
                              >
                                <Plus size={11} /> добавить
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Btn onClick={onSaveFinal} disabled={savingSchedule} className="w-full justify-center mt-4">
            <Save size={16} />{savingSchedule ? 'Сохраняю…' : 'Сохранить итоговый график'}
          </Btn>
          <p className="text-xs text-center mt-2 inline-flex items-center gap-1 w-full justify-center" style={{ color: BRAND.inkSoft }}>
            <PenLine size={12} /> Ячейки можно править вручную перед сохранением
          </p>
        </>
      )}
    </div>
  );
}

/* ================= ADMIN GATE (password) ================= */
function AdminGate({ onBack }) {
  const [checking, setChecking] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [savedPin, setSavedPin] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const pin = await storageGet('admin_pin');
      setSavedPin(pin);
      setHasPin(!!pin);
      setChecking(false);
    })();
  }, []);

  const trySubmit = async () => {
    if (busy) return;
    if (!hasPin) {
      if (input.trim().length < 4) {
        setError('Минимум 4 символа');
        return;
      }
      setBusy(true);
      await storageSet('admin_pin', input.trim());
      setBusy(false);
      setUnlocked(true);
      return;
    }
    if (input === savedPin) {
      setUnlocked(true);
    } else {
      setError('Неверный пароль');
      setInput('');
    }
  };

  if (checking) return <CenterNote text="Загрузка…" />;
  if (unlocked) return <AdminView onBack={onBack} />;

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <TopBar onBack={onBack} title="Администратор" />
      <div className="vaha-card p-6 mt-8 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: BRAND.creamDeep }}>
          <ShieldCheck size={22} color={BRAND.terracotta} />
        </div>
        {hasPin ? (
          <>
            <div className="font-semibold mb-1">Введите пароль</div>
            <p className="text-xs mb-4" style={{ color: BRAND.inkSoft }}>Доступ только для администратора</p>
          </>
        ) : (
          <>
            <div className="font-semibold mb-1">Задайте пароль администратора</div>
            <p className="text-xs mb-4" style={{ color: BRAND.inkSoft }}>Он понадобится при каждом входе сюда. Поменять можно потом в настройках.</p>
          </>
        )}
        <input
          type="password"
          inputMode="numeric"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && trySubmit()}
          className="w-full text-center text-lg mb-3"
          placeholder="••••"
          autoFocus
        />
        {error && <div className="text-xs mb-3" style={{ color: BRAND.rust }}>{error}</div>}
        <Btn onClick={trySubmit} disabled={busy} className="w-full justify-center">
          {hasPin ? 'Войти' : 'Сохранить и войти'}
        </Btn>
      </div>
    </div>
  );
}

/* ================= ROOT ================= */
export default function VahaGrafikApp() {
  const [role, setRole] = useState(null);
  return (
    <div className="vaha-root min-h-screen">
      <style>{FONT_CSS}</style>
      {role === null && <RoleSelect onPick={setRole} />}
      {role === 'waiter' && <WaiterView onBack={() => setRole(null)} />}
      {role === 'admin' && <AdminGate onBack={() => setRole(null)} />}
    </div>
  );
}
