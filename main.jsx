import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Activity, Archive, ArrowRight, BarChart3, Bell, BookOpen, Bookmark, Bot, Braces, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Circle, Clock3, Code2, Coffee, Command, FileCode2, FileText,
  Flame, Folder, FolderPlus, GraduationCap, Grid2X2, HelpCircle, Home, Inbox, LayoutDashboard, Lightbulb, Link, ListFilter,
  Menu, MoreHorizontal, Moon, NotebookPen, PanelLeftClose, PenLine, Play, Plus, Search, Settings, Sparkles, Star, Sun,
  Target, Terminal, Trophy, Upload, Video, X, Zap, ClipboardCheck, ChartNoAxesCombined, CircleAlert, RotateCcw, Layers3,
  CodeXml, BookMarked, Ellipsis, FolderOpen, Filter, Copy, Trash2, Save, ArrowUpRight, LockKeyhole, Eye, Share2, FileQuestion, EyeOff
} from 'lucide-react';
import './styles.css';
import './auth.css';

// CODERA's initial local model. It mirrors the server entities (subjects, lessons,
// resources, notes, code, tests, revision, and activity) so replacing this store
// with API calls does not change the interface layer.
const seed = {
  tasks: [], subjects: [], lessons: [], notes: [], resources: [], code: [], revision: [], videos: [], roadmaps: [], exams: []
};
const STORAGE_KEY = 'codera-clean-workspace-v1';

const NAV = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { group: 'LEARNING' },
  { id: 'subjects', icon: BookOpen, label: 'Subjects' },
  { id: 'lessons', icon: GraduationCap, label: 'My lessons' },
  { id: 'roadmaps', icon: Layers3, label: 'Roadmaps' },
  { id: 'videos', icon: Video, label: 'Videos' },
  { id: 'exams', icon: CalendarDays, label: 'Exams' },
  { group: 'WORKSPACE' },
  { id: 'coding', icon: Code2, label: 'Code studio' },
  { id: 'practice', icon: Braces, label: 'Practice' },
  { id: 'tests', icon: ClipboardCheck, label: 'Tests' },
  { id: 'interview', icon: Bot, label: 'Interview mode' },
  { group: 'YOUR LIBRARY' },
  { id: 'library', icon: Folder, label: 'Library' },
  { id: 'notes', icon: NotebookPen, label: 'Notes' },
  { id: 'revision', icon: RotateCcw, label: 'Revision' },
  { id: 'progress', icon: ChartNoAxesCombined, label: 'Progress' },
];

const actionIcons = { note: NotebookPen, folder: FolderPlus, resource: Upload, code: Terminal, test: ClipboardCheck, problem: Braces };
const cx = (...args) => args.filter(Boolean).join(' ');
const pct = (value) => ({ width: `${value}%` });
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayLabel = () => new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
const STREAK_KEY = 'codera-visit-streak-v1';
const getVisitStreak = () => {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');
    if (!saved || !saved.lastVisitAt) {
      const fresh = { count: 1, lastVisitAt: now };
      localStorage.setItem(STREAK_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const elapsed = now - saved.lastVisitAt;
    if (elapsed >= 24 * 60 * 60 * 1000 && elapsed < 48 * 60 * 60 * 1000) {
      const next = { count: (saved.count || 0) + 1, lastVisitAt: now };
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      return next;
    }
    if (elapsed >= 48 * 60 * 60 * 1000) {
      const reset = { count: 1, lastVisitAt: now };
      localStorage.setItem(STREAK_KEY, JSON.stringify(reset));
      return reset;
    }
    return saved;
  } catch {
    const fallback = { count: 1, lastVisitAt: now };
    localStorage.setItem(STREAK_KEY, JSON.stringify(fallback));
    return fallback;
  }
};

const makeExamPlan = (name, topics) => {
  const normalized = topics.filter(Boolean);
  if (/data\s*structures?/i.test(name) && normalized.length === 0) {
    return [
      'Arrays + Linked List',
      'Stack + Queue',
      'Trees',
      'Revision + Tests'
    ];
  }
  if (normalized.length === 0) {
    return ['Foundations', 'Core concepts', 'Practice + problem solving', 'Revision + Tests'];
  }
  const weeks = Array.from({length: 4}, () => []);
  normalized.forEach((topic, index) => weeks[index % 4].push(topic));
  return weeks.map((items, index) => items.length ? items.join(' + ') : index === 3 ? 'Revision + Tests' : 'Practice + review');
};

const formatExamDate = (value) => {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const daysRemaining = (value) => {
  if (!value) return 0;
  const target = new Date(`${value}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target - today) / 86400000);
};

const interviewQuestions = {
  Python: [
    { q: 'What is the difference between a list and a tuple in Python?', keys: ['list', 'tuple', 'mutable', 'immutable'], area: 'Python data types' },
    { q: 'What is a Python dictionary and when would you use it?', keys: ['key', 'value', 'hash', 'lookup'], area: 'Python collections' },
    { q: 'Explain what a list comprehension does.', keys: ['expression', 'loop', 'list', 'condition'], area: 'Python syntax' }
  ],
  DSA: [
    { q: 'What is the time complexity of binary search on a sorted array?', keys: ['log', 'o(log', 'sorted'], area: 'Complexity analysis' },
    { q: 'How does a stack differ from a queue?', keys: ['lifo', 'fifo', 'stack', 'queue'], area: 'Linear data structures' },
    { q: 'Why can a linked list be useful compared with an array?', keys: ['node', 'pointer', 'insert', 'memory', 'dynamic'], area: 'Linked lists' }
  ],
  Java: [
    { q: 'What is the difference between method overloading and overriding?', keys: ['same name', 'parameters', 'inherit', 'runtime', 'compile'], area: 'Java OOP' },
    { q: 'What is encapsulation?', keys: ['private', 'class', 'access', 'data', 'method'], area: 'Java OOP' },
    { q: 'What is the difference between == and .equals() in Java?', keys: ['reference', 'value', 'equals', 'object'], area: 'Java basics' }
  ],
  HR: [
    { q: 'Tell me about yourself and the kind of role you are preparing for.', keys: ['education', 'project', 'skill', 'goal'], area: 'Introduction' },
    { q: 'Describe a project where you solved a difficult problem.', keys: ['problem', 'solution', 'role', 'result'], area: 'Project discussion' },
    { q: 'What is one weakness you are actively improving?', keys: ['weakness', 'improve', 'practice', 'learn'], area: 'Self-awareness' }
  ]
};
const formatStudyTime = (seconds) => {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

const getAuthUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    username: user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    avatarUrl: user.user_metadata?.avatar_url || null,
    provider: user.app_metadata?.provider || 'email'
  };
};

const getOAuthRedirectUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

const getUserStorageKey = (userId) => `${STORAGE_KEY}:${userId}`;

const readLocalWorkspace = (userId) => {
  try {
    const scoped = userId ? localStorage.getItem(getUserStorageKey(userId)) : null;
    const legacy = localStorage.getItem(STORAGE_KEY);
    return { ...seed, ...(JSON.parse(scoped || legacy || 'null') || {}) };
  } catch {
    return { ...seed };
  }
};

const loadCloudWorkspace = async (userId) => {
  if (!supabase || !userId) return null;
  const { data: rows, error } = await supabase
    .from('user_data')
    .select('id,data,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = rows?.[0];
  if (!row?.data) return null;
  return { rowId: row.id, payload: row.data };
};

const saveCloudWorkspace = async (userId, payload, rowId = null) => {
  if (!supabase || !userId) return;
  if (rowId) {
    const { error } = await supabase.from('user_data').update({ data: payload }).eq('id', rowId).eq('user_id', userId);
    if (error) throw error;
    return rowId;
  }
  const { data: rows, error: lookupError } = await supabase
    .from('user_data')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (lookupError) throw lookupError;
  const existingId = rows?.[0]?.id;
  if (existingId) {
    const { error } = await supabase.from('user_data').update({ data: payload }).eq('id', existingId).eq('user_id', userId);
    if (error) throw error;
    return existingId;
  }
  const { data: created, error } = await supabase
    .from('user_data')
    .insert({ user_id: userId, data: payload })
    .select('id')
    .single();
  if (error) throw error;
  return created?.id || null;
};


function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.');
      return;
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    if (mode === 'signup') {
      if (cleanUsername.length < 3) return setError('Username must be at least 3 characters.');
      if (password !== confirmPassword) return setError('Passwords do not match.');
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { username: cleanUsername } }
        });
        if (signUpError) throw signUpError;

        if (data.session && data.user) {
          onAuthenticated(getAuthUser(data.user));
        } else {
          setMessage('Account created. Check your email and confirm your address before logging in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });
        if (signInError) throw signInError;
        if (data.user) onAuthenticated(getAuthUser(data.user));
      }
    } catch (authError) {
      setError(authError?.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError('');
    setMessage('');
    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.');
      return;
    }
    setBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getOAuthRedirectUrl() }
    });
    if (oauthError) {
      setBusy(false);
      setError(oauthError.message || 'Google sign-in could not be started.');
    }
  };

  return <div className="auth-screen">
    <div className="auth-glow auth-glow-one" />
    <div className="auth-glow auth-glow-two" />
    <div className="auth-shell">
      <div className="auth-brand"><div className="auth-brand-mark">{'<>'}</div><div><strong>CODERA</strong><span>learning OS</span></div></div>
      <div className="auth-card">
        <div className="auth-heading">
          <span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your CODERA account.'}</h1>
          <p>{mode === 'login' ? 'Sign in to continue your learning workspace.' : 'Create an account to start your personal learning workspace.'}</p>
        </div>
        <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => {setMode('login');setError('');setMessage('')}}>Login</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => {setMode('signup');setError('');setMessage('')}}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>USERNAME<input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" /></label>}
          <label>EMAIL<input autoFocus={mode === 'login'} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>PASSWORD<div className="auth-password"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          {mode === 'signup' && <label>CONFIRM PASSWORD<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" /></label>}
          {error && <div className="auth-error"><CircleAlert size={15}/><span>{error}</span></div>}
          {message && <div className="auth-message"><CheckCircle2 size={15}/><span>{message}</span></div>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login to CODERA' : 'Create account'}<ArrowRight size={17}/></button>
        </form>
        <div className="auth-divider"><span>OR</span></div>
        <button type="button" className="google-button" onClick={continueWithGoogle} disabled={busy}><span className="google-g">G</span>Continue with Google</button>
        <p className="auth-foot">{mode === 'login' ? "Don't have an account? " : 'Already have an account? '}<button type="button" onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setError('');setMessage('')}}>{mode === 'login' ? 'Create account' : 'Login'}</button></p>
      </div>
      <div className="auth-note"><LockKeyhole size={13}/> Your account is securely managed by Supabase Authentication.</div>
    </div>
  </div>;
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudRowId, setCloudRowId] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('codera-theme') || 'dark');
  const [studySeconds, setStudySeconds] = useState(() => Number(localStorage.getItem('codera-study-seconds') || 0));
  const [visitStreak, setVisitStreak] = useState(() => getVisitStreak());
  const [data, setData] = useState(() => readLocalWorkspace(null));
  const [page, setPage] = useState('dashboard');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectMaterialModal, setSubjectMaterialModal] = useState(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [selectedRoadmapPhase, setSelectedRoadmapPhase] = useState(null);
  const [selectedVideoFolder, setSelectedVideoFolder] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [videoCreateContext, setVideoCreateContext] = useState(null);
  const [roadmapContentModal, setRoadmapContentModal] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [interviewMode, setInterviewMode] = useState('DSA');
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthUser(getAuthUser(data.session?.user || null));
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(getAuthUser(session?.user || null));
      setAuthLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('codera-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!authUser?.id) return;
    localStorage.setItem(getUserStorageKey(authUser.id), JSON.stringify(data));
  }, [data, authUser?.id]);

  useEffect(() => {
    if (!authUser?.id || !supabase) {
      setCloudReady(false);
      setCloudRowId(null);
      return undefined;
    }
    let cancelled = false;
    setCloudReady(false);
    setCloudRowId(null);
    (async () => {
      try {
        const cloud = await loadCloudWorkspace(authUser.id);
        if (cancelled) return;
        if (cloud?.payload) {
          const workspace = cloud.payload.workspace || cloud.payload.data || cloud.payload;
          setData({ ...seed, ...(workspace || {}) });
          if (typeof cloud.payload.studySeconds === 'number') setStudySeconds(cloud.payload.studySeconds);
          setCloudRowId(cloud.rowId || null);
        } else {
          const localWorkspace = readLocalWorkspace(authUser.id);
          const hasLocalData = localWorkspace && Object.keys(localWorkspace).some(key => Array.isArray(localWorkspace[key]) ? localWorkspace[key].length : false);
          setData(localWorkspace);
          const payload = { version: 2, workspace: localWorkspace, studySeconds: Number(localStorage.getItem('codera-study-seconds') || 0), updatedAt: new Date().toISOString() };
          const createdId = await saveCloudWorkspace(authUser.id, payload);
          if (!cancelled) setCloudRowId(createdId || null);
          if (!hasLocalData) localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('CODERA cloud workspace load failed:', error);
        if (!cancelled) setToast('Cloud sync is unavailable. Your work is still saved locally.');
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    localStorage.setItem(`${getUserStorageKey(authUser.id)}:study-time`, String(studySeconds));
    localStorage.setItem('codera-study-seconds', String(studySeconds));
  }, [studySeconds, authUser?.id]);

  useEffect(() => {
    if (!authUser?.id || !cloudReady || !supabase) return undefined;
    const timer = setTimeout(async () => {
      try {
        const id = await saveCloudWorkspace(authUser.id, {
          version: 2,
          workspace: data,
          studySeconds,
          updatedAt: new Date().toISOString()
        }, cloudRowId);
        if (id && id !== cloudRowId) setCloudRowId(id);
      } catch (error) {
        console.error('CODERA cloud workspace save failed:', error);
        setToast('Could not sync the latest change. It remains saved locally.');
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [data, studySeconds, authUser?.id, cloudReady, cloudRowId]);
  useEffect(() => {
    let timer = null;
    const start = () => {
      if (timer || document.visibilityState !== 'visible') return;
      timer = window.setInterval(() => setStudySeconds(value => value + 1), 1000);
    };
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => document.visibilityState === 'visible' ? start() : stop();
    document.addEventListener('visibilitychange', handleVisibility);
    start();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2800); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    const hotkey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); } if (event.key === 'Escape') { setSearchOpen(false); setModal(null); } };
    window.addEventListener('keydown', hotkey); return () => window.removeEventListener('keydown', hotkey);
  }, []);
  const navigate = (next) => {
    setPage(next);
    setSelectedLesson(null);
    setSelectedSubject(null);
    setSelectedRoadmap(null);
    setSelectedRoadmapPhase(null);
    setSelectedVideoFolder(null);
    setSelectedExam(null);
    setVideoCreateContext(null);
    setRoadmapContentModal(null);
    setSidebarOpen(false);
  };
  const openLesson = (lesson) => {
    if (!lesson) return;
    setSelectedLesson(lesson);
    setSelectedSubject(null);
    setSelectedRoadmap(null);
    setSelectedRoadmapPhase(null);
    setSelectedVideoFolder(null);
    setPage('lesson');
    setSidebarOpen(false);
  };
  const openSubject = (subject) => {
    setSelectedSubject(subject);
    setSelectedLesson(null);
    setSelectedRoadmap(null);
    setSelectedRoadmapPhase(null);
    setSelectedVideoFolder(null);
    setPage('subject');
    setSidebarOpen(false);
  };
  const openRoadmap = (roadmap) => {
    setSelectedRoadmap(roadmap);
    setSelectedRoadmapPhase(null);
    setSelectedLesson(null);
    setSelectedSubject(null);
    setSelectedVideoFolder(null);
    setPage('roadmap');
    setSidebarOpen(false);
  };
  const openRoadmapPhase = (phase, roadmap) => {
    setSelectedRoadmap(roadmap);
    setSelectedRoadmapPhase(phase);
    setSelectedLesson(null);
    setSelectedSubject(null);
    setSelectedVideoFolder(null);
    setPage('roadmap-phase');
    setSidebarOpen(false);
  };

  const saveRoadmapPhase = (roadmapId, phaseId, values) => {
    setData(d => ({
      ...d,
      roadmaps: d.roadmaps.map(r => r.id === roadmapId ? {
        ...r,
        phases: (r.phases || []).map(p => p.id === phaseId ? {
          ...p,
          body: values.body ?? p.body ?? '',
          image: values.image ?? p.image ?? '',
          links: values.links ?? p.links ?? [],
          updated: 'Just now'
        } : p),
        updated: 'Just now'
      } : r)
    }));
    setSelectedRoadmapPhase(p => p ? {
      ...p,
      body: values.body ?? p.body ?? '',
      image: values.image ?? p.image ?? '',
      links: values.links ?? p.links ?? [],
      updated: 'Just now'
    } : p);
    setToast('Phase saved');
  };

  const openVideoFolder = (folder) => {
    setSelectedVideoFolder(folder);
    setSelectedLesson(null);
    setSelectedSubject(null);
    setSelectedRoadmap(null);
    setPage('video-folder');
    setSidebarOpen(false);
  };
  const mutateTask = (id) => setData(d => ({
    ...d,
    tasks: d.tasks.map(t => {
      if (t.id !== id) return t;
      const nextStatus = t.status === 'Done'
        ? 'Not started'
        : t.status === 'Not started'
          ? 'In progress'
          : 'Done';
      return { ...t, status: nextStatus, done: nextStatus === 'Done', date: todayKey() };
    })
  }));
  const createItem = (type, values) => {
    const id = Date.now();

    if (type === 'subject-material') {
      if (values.materialType === 'note') {
        setData(d => ({
          ...d,
          notes: [{
            id,
            title: values.title || 'Untitled note',
            body: values.body || '',
            subject: values.subject,
            tags: [],
            updated: 'Just now',
            favorite: false,
            color: '#6f9b96'
          }, ...d.notes]
        }));
        setSubjectMaterialModal(null);
        setToast(`Note added to ${values.subject}`);
        return;
      }

      if (values.materialType === 'url') {
        setData(d => ({
          ...d,
          resources: [{
            id,
            name: values.title || 'Saved link',
            type: 'URL',
            size: 'Link',
            subject: values.subject,
            topic: 'Unsorted',
            updated: 'Just now',
            favorite: false,
            tint: '#6f9b96',
            url: values.url
          }, ...d.resources]
        }));
        setSubjectMaterialModal(null);
        setToast(`URL added to ${values.subject}`);
        return;
      }

      if (values.materialType === 'file' && values.file) {
        const file = values.file;
        const reader = new FileReader();
        reader.onload = () => {
          setData(d => ({
            ...d,
            resources: [{
              id,
              name: values.title || file.name,
              type: 'FILE',
              size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
              subject: values.subject,
              topic: 'Unsorted',
              updated: 'Just now',
              favorite: false,
              tint: '#6f9b96',
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              data: reader.result
            }, ...d.resources]
          }));
          setSubjectMaterialModal(null);
          setToast(`File added to ${values.subject}`);
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    if (type === 'video-folder') {
      const folder = {
        id,
        type: 'folder',
        title: values.title || 'New video folder',
        url: '',
        status: 'Folder',
        subject: 'General',
        updated: 'Just now'
      };
      setData(d => ({ ...d, videos: [folder, ...d.videos] }));
      setModal(null);
      setToast('Video folder created');
      return;
    }

    if (type === 'video') {
      const video = {
        id,
        type: 'video',
        folderId: values.folderId || null,
        title: values.title || 'Untitled video',
        url: values.url || '',
        status: 'Watch later',
        subject: values.subject || 'General',
        updated: 'Just now'
      };
      setData(d => ({ ...d, videos: [video, ...d.videos] }));
      setVideoCreateContext(null);
      setToast(`Video added${values.folderName ? ` to ${values.folderName}` : ''}`);
      return;
    }

    if (type === 'roadmap') {
      const roadmap = {
        id,
        title: values.title || 'Untitled roadmap',
        phases: values.phase ? [{ id: `${id}-phase`, title: values.phase }] : [],
        progress: 0,
        updated: 'Just now',
        description: '',
        image: '',
        links: [],
        items: []
      };
      setData(d => ({ ...d, roadmaps: [roadmap, ...d.roadmaps] }));
      setSelectedRoadmap(roadmap);
      setPage('roadmap');
      setModal(null);
      setToast('Roadmap created');
      return;
    }

    if (type === 'roadmap-content') {
      const item = values.item;
      setData(d => ({
        ...d,
        roadmaps: d.roadmaps.map(r => r.id === values.roadmapId ? {
          ...r,
          description: values.description ?? r.description ?? '',
          image: values.image ?? r.image ?? '',
          links: values.link ? [...(r.links || []), values.link] : (r.links || []),
          phases: values.phase ? [...(r.phases || []), { id: `${id}-phase`, title: values.phase }] : (r.phases || []),
          items: item ? [...(r.items || []), { id, ...item }] : (r.items || []),
          updated: 'Just now'
        } : r)
      }));
      setRoadmapContentModal(null);
      setToast('Roadmap updated');
      return;
    }

    if (type === 'exam') {
      const exam = {
        id,
        name: values.title || 'Untitled exam',
        date: values.date,
        topics: values.topics || [],
        plan: makeExamPlan(values.title || '', values.topics || []),
        createdAt: Date.now()
      };
      setData(d => ({ ...d, exams: [exam, ...(d.exams || [])] }));
      setSelectedExam(exam);
      setModal(null);
      setPage('exams');
      setToast('Exam preparation mode created');
      return;
    }

    if (type === 'task') {
      const status = values.status || 'Not started';
      const task = {
        id,
        subject: values.subject || 'General',
        label: values.task || values.title || 'New task',
        category: values.category || 'Study',
        status,
        done: status === 'Done',
        tone: values.tone || 'violet',
        date: todayKey(),
        createdAt: Date.now()
      };
      setData(d => ({ ...d, tasks: [task, ...d.tasks] }));
      setModal(null);
      setToast('Task added to today’s plan');
      return;
    }

    if (type === 'note') setData(d => ({ ...d, notes: [{ id, title: values.title || 'Untitled note', body: values.body || '', subject: values.subject || 'General', tags: [], updated: 'Just now', favorite: false, color: '#6f9b96' }, ...d.notes] }));
    if (type === 'subject') setData(d => ({ ...d, subjects: [...d.subjects, { id: `sub-${id}`, name: values.title || 'New subject', code: 'NEW', color: '#6f9b96', progress: 0, lessons: 0, completed: 0, last: 'No lessons yet', icon: '✦' }] }));
    if (type === 'folder') setData(d => ({ ...d, resources: [{ id, name: values.title || 'New folder', type: 'FOLDER', size: '—', subject: 'Personal', topic: 'Unsorted', updated: 'Just now', createdAt: Date.now(), favorite: false, tint: '#6f9b96', parentId: values.parentId || null }, ...d.resources] }));
    if (type === 'library-url') {
      setData(d => ({ ...d, resources: [{ id, name: values.title || 'Saved link', type: 'URL', size: 'Link', subject: 'Personal', topic: 'Unsorted', updated: 'Just now', createdAt: Date.now(), favorite: false, tint: '#6f9b96', parentId: values.folderId || null, url: values.url }, ...d.resources] }));
      setToast('Link added to folder');
      return;
    }
    if (type === 'library-file' && values.file) {
      const file = values.file;
      const reader = new FileReader();
      reader.onload = () => {
        setData(d => ({ ...d, resources: [{
          id,
          name: file.name,
          type: 'FILE',
          size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          subject: 'Personal',
          topic: 'Unsorted',
          updated: 'Just now',
          createdAt: Date.now(),
          favorite: false,
          tint: '#6f9b96',
          parentId: values.folderId || null,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: reader.result
        }, ...d.resources] }));
        setToast('File added to folder');
      };
      reader.readAsDataURL(file);
      return;
    }
    setModal(null);
    setToast(`${type === 'subject' ? 'Subject' : type[0].toUpperCase() + type.slice(1)} created`);
  };

  const renameEntity = (type, id, name) => {
    if (type === '__favorite__') {
      setData(d => ({ ...d, resources: d.resources.map(item => item.id === id ? { ...item, favorite: name === '1' } : item) }));
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) return;
    setData(d => ({
      ...d,
      subjects: type === 'subject' ? d.subjects.map(item => item.id === id ? { ...item, name: cleanName } : item) : d.subjects,
      videos: type === 'video' || type === 'video-folder' ? d.videos.map(item => item.id === id ? { ...item, title: cleanName } : item) : d.videos,
      roadmaps: type === 'roadmap' ? d.roadmaps.map(item => item.id === id ? { ...item, title: cleanName, updated: 'Just now' } : item) : d.roadmaps,
      resources: type === 'resource' ? d.resources.map(item => item.id === id ? { ...item, name: cleanName, updated: 'Just now' } : item) : d.resources
    }));
    if (type === 'subject' && selectedSubject?.id === id) setSelectedSubject(s => ({ ...s, name: cleanName }));
    if (type === 'roadmap' && selectedRoadmap?.id === id) setSelectedRoadmap(r => ({ ...r, title: cleanName }));
    if (type === 'video-folder' && selectedVideoFolder?.id === id) setSelectedVideoFolder(f => ({ ...f, title: cleanName }));
    setToast('Name updated');
  };

  const deleteEntity = (type, id) => {
    const label = type === 'subject' ? 'subject' : type === 'roadmap' ? 'roadmap' : type === 'video-folder' ? 'video folder' : 'video';
    if (!window.confirm(`Delete this ${label}?`)) return;

    if (type === 'subject') {
      const target = data.subjects.find(item => item.id === id);
      setData(d => ({
        ...d,
        subjects: d.subjects.filter(item => item.id !== id),
        notes: target ? d.notes.filter(item => item.subject !== target.name) : d.notes,
        resources: target ? d.resources.filter(item => item.subject !== target.name) : d.resources
      }));
      if (selectedSubject?.id === id) navigate('subjects');
    }
    if (type === 'roadmap') {
      setData(d => ({ ...d, roadmaps: d.roadmaps.filter(item => item.id !== id) }));
      if (selectedRoadmap?.id === id) navigate('roadmaps');
    }
    if (type === 'video-folder') {
      setData(d => ({ ...d, videos: d.videos.filter(item => item.id !== id && item.folderId !== id) }));
      if (selectedVideoFolder?.id === id) navigate('videos');
    }
    if (type === 'video') setData(d => ({ ...d, videos: d.videos.filter(item => item.id !== id) }));
    if (type === 'resource') {
      const target = data.resources.find(item => item.id === id);
      const removeIds = new Set([id]);
      if (target?.type === 'FOLDER') {
        let changed = true;
        while (changed) {
          changed = false;
          data.resources.forEach(item => {
            if (item.parentId && removeIds.has(item.parentId) && !removeIds.has(item.id)) {
              removeIds.add(item.id);
              changed = true;
            }
          });
        }
      }
      setData(d => ({ ...d, resources: d.resources.filter(item => !removeIds.has(item.id)) }));
      setToast(target?.type === 'FOLDER' ? 'Folder and its contents deleted' : 'Library item deleted');
      return;
    }
    setToast(`${label[0].toUpperCase() + label.slice(1)} deleted`);
  };

  const pageTitle = selectedLesson
    ? selectedLesson.title
    : selectedSubject
      ? selectedSubject.name
      : selectedRoadmap
        ? selectedRoadmap.title
        : ({ dashboard: 'Dashboard', subjects: 'Your subjects', lessons: 'My lessons', subject: 'Subject workspace', roadmap: 'Roadmap', 'roadmap-phase': 'Phase notebook', 'video-folder': 'Video folder', roadmaps: 'Roadmaps', videos: 'Video library', coding: 'Code studio', practice: 'Practice', tests: 'Tests', library: 'Library', notes: 'Notes', revision: 'Revision', progress: 'Progress' }[page] || 'CODERA');

  if (authLoading) return <div className="auth-screen"><div className="auth-shell"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">CODERA</span><h1>Loading your account…</h1><p>Checking your secure Supabase session.</p></div></div></div></div>;
  if (!authUser) return <AuthScreen onAuthenticated={setAuthUser} />;

  return <div className="app-shell">
    <Sidebar current={page} isOpen={sidebarOpen} onNavigate={navigate} onClose={() => setSidebarOpen(false)} onNew={() => setModal('note')} />
    <main className="main-area">
      <Topbar title={pageTitle} theme={theme} setTheme={setTheme} onMenu={() => setSidebarOpen(true)} onSearch={() => setSearchOpen(true)} onNew={() => setModal('note')} />
      <div className="page-wrap">
        {page === 'dashboard' && <Dashboard data={data} studySeconds={studySeconds} visitStreak={visitStreak} onTask={mutateTask} onNavigate={navigate} onLesson={openLesson} onAction={setModal} />}
        {page === 'subjects' && <Subjects data={data} onAdd={() => setModal('subject')} onSubject={openSubject} onRename={(id, name) => renameEntity('subject', id, name)} onDelete={(id) => deleteEntity('subject', id)} />}
        {page === 'subject' && selectedSubject && <SubjectWorkspace subject={selectedSubject} data={data} onBack={() => navigate('subjects')} onAddMaterial={setSubjectMaterialModal} onLesson={openLesson} />}
        {page === 'lessons' && <Lessons data={data} onLesson={openLesson} onNavigate={navigate} />}
        {page === 'lesson' && selectedLesson && <LessonRoom lesson={selectedLesson} onNavigate={navigate} onToast={setToast} />}
        {page === 'library' && <Library data={data} onNew={(request) => {
      if (request?.type) createItem(request.type, request);
      else setModal('folder');
    }} onRename={renameEntity} onDelete={deleteEntity} />}
        {page === 'notes' && <Notes data={data} onNew={() => setModal('note')} setData={setData} />}
        {page === 'coding' && <CodeStudio data={data} setData={setData} onToast={setToast} />}
        {page === 'revision' && <CleanRevision data={data} onNavigate={navigate} />}
        {page === 'progress' && <CleanProgress data={data} onNavigate={navigate} />}
        {page === 'roadmaps' && <Roadmaps data={data} onNew={() => setModal('roadmap')} onOpen={openRoadmap} onRename={(id, name) => renameEntity('roadmap', id, name)} onDelete={(id) => deleteEntity('roadmap', id)} />}
        {page === 'roadmap' && selectedRoadmap && <RoadmapWorkspace roadmap={selectedRoadmap} data={data} onBack={() => navigate('roadmaps')} onAdd={(type) => setRoadmapContentModal({ type, roadmapId: selectedRoadmap.id })} onOpenPhase={(phase) => openRoadmapPhase(phase, selectedRoadmap)} onRename={(id, name) => renameEntity('roadmap', id, name)} onDelete={(id) => deleteEntity('roadmap', id)} />}
        {page === 'roadmap-phase' && selectedRoadmap && selectedRoadmapPhase && <RoadmapPhaseWorkspace roadmap={selectedRoadmap} phase={selectedRoadmapPhase} onBack={() => openRoadmap(selectedRoadmap)} onSave={saveRoadmapPhase} />}
        {page === 'videos' && <Videos data={data} onNewFolder={() => setModal('video-folder')} onAddVideo={() => setVideoCreateContext({ folderId: null, folderName: '' })} onOpen={openVideoFolder} onRename={renameEntity} onDelete={deleteEntity} />}
        {page === 'exams' && <ExamPreparation data={data} selectedExam={selectedExam} onOpen={setSelectedExam} onNew={() => setModal('exam')} onDelete={(id) => { setData(d => ({ ...d, exams: d.exams.filter(item => item.id !== id) })); setSelectedExam(null); setToast('Exam deleted'); }} />}
        {page === 'interview' && <InterviewMode mode={interviewMode} setMode={setInterviewMode} onToast={setToast} />}
        {page === 'video-folder' && selectedVideoFolder && <VideoFolderWorkspace folder={selectedVideoFolder} data={data} onBack={() => navigate('videos')} onAddVideo={() => setVideoCreateContext({ folderId: selectedVideoFolder.id, folderName: selectedVideoFolder.title })} onRename={(id, name) => renameEntity('video-folder', id, name)} onDelete={(id) => deleteEntity('video-folder', id)} />}
        {['practice','tests'].includes(page) && <ComingSoon page={page} onNavigate={navigate} />}
      </div>
    </main>
    <MobileNav current={page} onNavigate={navigate} />
    {searchOpen && <SearchPalette data={data} query={search} setQuery={setSearch} onClose={() => setSearchOpen(false)} onNavigate={navigate} onLesson={openLesson} />}
    {modal && <SimpleCreateModal type={modal} onClose={() => setModal(null)} onSubmit={createItem} />}
    {subjectMaterialModal && selectedSubject && <SubjectMaterialModal type={subjectMaterialModal} subject={selectedSubject} onClose={() => setSubjectMaterialModal(null)} onSubmit={(values) => createItem('subject-material', values)} />}
    {videoCreateContext && <VideoModal folderId={videoCreateContext.folderId} folderName={videoCreateContext.folderName} subjects={data.subjects} onClose={() => setVideoCreateContext(null)} onSubmit={(values) => createItem('video', values)} />}
    {roadmapContentModal && <RoadmapContentModal type={roadmapContentModal.type} roadmapId={roadmapContentModal.roadmapId} onClose={() => setRoadmapContentModal(null)} onSubmit={(values) => createItem('roadmap-content', values)} />}
    {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function Brand() { return <div className="brand"><div className="brand-mark"><span>{'<>'}</span></div><div><strong>CODERA</strong><small>learning OS</small></div></div>; }
function Sidebar({ current, isOpen, onNavigate, onClose, onNew }) { return <>
  <aside className={cx('sidebar', isOpen && 'open')}>
    <div className="sidebar-head"><Brand/><button className="icon-button desktop-only" title="Collapse sidebar"><PanelLeftClose size={19}/></button><button className="icon-button mobile-only" onClick={onClose}><X size={19}/></button></div>
    <button className="new-workspace" onClick={onNew}><Plus size={17}/> Create new <ChevronDown size={15}/></button>
    <nav>{NAV.map((item, i) => item.group ? <div className="nav-group" key={i}>{item.group}</div> : <button key={item.id} className={cx('nav-item', current === item.id && 'active')} onClick={() => onNavigate(item.id)}><item.icon size={18}/><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>)}</nav>
    <div className="sidebar-bottom">
      <button className="coach-card" onClick={() => onNavigate('revision')}><div className="coach-icon"><Sparkles size={17}/></div><div><strong>Study coach</strong><span>Plan your next session</span></div><ArrowRight size={15}/></button>
      <button className="profile-row" onClick={() => onNavigate('progress')}><div className="avatar">VS</div><div><strong>Vedant</strong><span>Level 08 · Explorer</span></div><ChevronsUpDown size={15}/></button>
    </div>
  </aside><div className={cx('sidebar-overlay', isOpen && 'visible')} onClick={onClose}/>
</> }
function Topbar({title, theme, setTheme, onMenu, onSearch, onNew}) { return <header className="topbar"><div className="top-title"><button className="icon-button menu-trigger" onClick={onMenu}><Menu size={21}/></button><div><span className="eyebrow">MY SPACE</span><h1>{title}</h1></div></div><div className="top-actions"><button className="search-trigger" onClick={onSearch}><Search size={17}/><span>Search anything</span><kbd>⌘ K</kbd></button><button className="icon-button theme-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-button notification"><Bell size={18}/><i/></button><button className="primary-button compact" onClick={onNew}><Plus size={17}/><span>New</span></button></div></header> }
function MobileNav({current, onNavigate}) { const items = [{id:'dashboard',icon:Home,label:'Home'}, {id:'subjects',icon:BookOpen,label:'Learn'}, {id:'coding',icon:Code2,label:'Code'}, {id:'revision',icon:RotateCcw,label:'Revise'}, {id:'library',icon:Folder,label:'Library'}]; return <nav className="mobile-nav">{items.map(item => <button className={current === item.id ? 'active' : ''} key={item.id} onClick={() => onNavigate(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav> }

function Dashboard({data,studySeconds,visitStreak,onTask,onNavigate,onLesson,onAction}) {
 const today = todayKey();
 const dailyTasks = data.tasks.filter(t => !t.date || t.date === today);
 const completed = dailyTasks.filter(t => t.done || t.status === 'Done').length;
 return <div className="dashboard enter">
  <section className="welcome-row"><div><p className="muted">YOUR PERSONAL LEARNING SPACE</p><h2>Welcome to CODERA <span>✦</span></h2><p className="subcopy">Start simple. Add a subject, video, note, or roadmap when you’re ready.</p></div><div className="streak-card"><div className="streak-flame"><Flame size={24}/></div><div><strong>{visitStreak.count} day streak</strong><span>Visit CODERA once every 24 hours to grow it</span></div><div className="week-dots">{[1,2,3,4,5,6,7].map(n => <i key={n}>{n}</i>)}</div></div></section>
  <section className="focus-card"><div className="focus-top"><div className="focus-label"><Sparkles size={17}/><span>YOUR FOCUS</span></div><button className="text-button" onClick={() => onNavigate('subjects')}>Add a subject <ArrowRight size={14}/></button></div><h3>Your workspace is ready.</h3><p>Create your first subject or roadmap to build a learning plan that is entirely yours.</p><div className="focus-timeline"><span>Start here</span><div><i/><i/><i/><i/></div><span>Learn your way</span></div></section>
  <section className="stat-grid">
   <Stat icon={Clock3} label="Study time" value={formatStudyTime(studySeconds)} detail="Time spent on CODERA" tint="violet"/><Stat icon={CheckCircle2} label="Lessons completed" value="0" detail="No lessons yet" tint="blue"/><Stat icon={Code2} label="Problems solved" value="0" detail="No problems yet" tint="orange"/><Stat icon={Target} label="Test accuracy" value="—" detail="No tests yet" tint="teal"/>
  </section>
  <section className="dashboard-grid">
   <div className="panel plan-panel daily-task-panel">
    <div className="panel-head daily-task-head">
      <div>
        <span className="eyebrow">TODAY'S LEARNING</span>
        <h3>Daily tasks <small>{completed}/{dailyTasks.length} complete</small></h3>
        <span className="daily-task-date">{todayLabel()}</span>
      </div>
      <button className="primary-button compact" onClick={() => onAction('task')}><Plus size={15}/> Add task</button>
    </div>
    <div className="daily-task-table">
      <div className="daily-task-table-head">
        <span>Subject</span><span>Task</span><span>Status</span><span/>
      </div>
      {dailyTasks.length ? dailyTasks.map(t => (
        <div className="daily-task-row" key={t.id}>
          <span className="task-subject-tag">{t.subject || 'General'}</span>
          <button className="daily-task-title" onClick={() => onTask(t.id)}>
            <CheckCircle2 size={16}/>
            <span>{t.label}</span>
          </button>
          <button
            className={cx('task-status', (t.status || (t.done ? 'Done' : 'Not started')).toLowerCase().replace(' ', '-'))}
            onClick={() => onTask(t.id)}
            title="Change status"
          >
            {t.status || (t.done ? 'Done' : 'Not started')}
          </button>
          <button className="icon-button task-more" title="Task options"><MoreHorizontal size={17}/></button>
        </div>
      )) : (
        <div className="daily-task-empty">
          <CalendarDays size={20}/>
          <div><strong>No tasks for today</strong><span>Add your first task for {todayLabel()}.</span></div>
          <button className="ghost-button" onClick={() => onAction('task')}><Plus size={15}/> Add task</button>
        </div>
      )}
    </div>
  </div>
   <div className="panel continue-panel"><div className="panel-head"><div><span className="eyebrow">CONTINUE LEARNING</span><h3>Nothing in progress</h3></div><button className="text-button" onClick={() => onNavigate('subjects')}>Add subject <ArrowRight size={14}/></button></div><div className="continue-list">{data.lessons.length ? data.lessons.slice(0,3).map(l=><button className="continue-item" key={l.id} onClick={()=>onLesson(l)}><div className="lesson-initial" style={{color:l.color,backgroundColor:`${l.color}18`}}>{l.number}</div><div className="continue-copy"><span>{l.subject}</span><strong>{l.title}</strong><div className="progress-line"><i style={{...pct(l.progress),background:l.color}}/></div></div><b>{l.progress}%</b><ArrowRight size={17}/></button>) : <EmptyInline icon={GraduationCap} text="Your active lessons will appear here."/>}</div></div>
  </section>
  <section className="quick-section"><div className="section-title"><div><span className="eyebrow">CREATE & ORGANIZE</span><h3>Quick actions</h3></div></div><div className="quick-grid"><Quick icon={NotebookPen} label="New note" detail="Capture an idea" onClick={()=>onAction('note')}/><Quick icon={FolderPlus} label="New folder" detail="Organize resources" onClick={()=>onAction('folder')}/><Quick icon={Upload} label="Add material" detail="PDF, link or video" onClick={()=>onNavigate('library')}/><Quick icon={Terminal} label="Start coding" detail="Open code studio" onClick={()=>onNavigate('coding')}/><Quick icon={ClipboardCheck} label="Create test" detail="Build a test later" onClick={()=>onNavigate('tests')}/><Quick icon={Braces} label="Add roadmap" detail="Plan your path" onClick={()=>onNavigate('roadmaps')}/></div></section>
  <section className="lower-grid"><div className="panel subject-panel"><div className="panel-head"><div><span className="eyebrow">LEARNING OVERVIEW</span><h3>Your subjects</h3></div><button className="text-button" onClick={()=>onNavigate('subjects')}>Manage <ArrowRight size={14}/></button></div><div className="subject-rows">{data.subjects.length ? data.subjects.map(s=><div className="subject-row" key={s.id}><div className="subject-symbol" style={{color:s.color,background:`${s.color}14`}}>{s.icon}</div><div><strong>{s.name}</strong><span>{s.completed} of {s.lessons} lessons</span></div><div className="subject-progress"><div className="progress-line"><i style={{...pct(s.progress),background:s.color}}/></div><span>{s.progress}%</span></div></div>) : <EmptyInline icon={BookOpen} text="Add a subject to begin organizing your learning."/>}</div></div><EmptySignals onNavigate={onNavigate}/></section>
 </div>
}
function Stat({icon:Icon,label,value,detail,tint}) {return <div className="stat-card"><div className={cx('stat-icon',tint)}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>}
function Quick({icon:Icon,label,detail,onClick}){return <button className="quick-card" onClick={onClick}><div><Icon size={19}/></div><strong>{label}</strong><span>{detail}</span><ArrowUpRight size={15}/></button>}
function EmptyInline({icon:Icon,text}) { return <div className="empty-inline"><Icon size={18}/><span>{text}</span></div> }
function EmptyWorkspace({icon:Icon,title,description,action,onAction}) { return <section className="empty-workspace panel"><div className="empty-workspace-icon"><Icon size={24}/></div><h3>{title}</h3><p>{description}</p>{action && <button className="primary-button" onClick={onAction}><Plus size={16}/>{action}</button>}</section> }
function EmptySignals({onNavigate}) {return <div className="panel weak-panel empty-signals"><div className="panel-head"><div><span className="eyebrow">LEARNING SIGNAL</span><h3>Insights will appear here</h3></div><Activity size={18}/></div><p>As you learn, practice, and take tests, CODERA will identify topics that need more attention.</p><button className="ghost-button" onClick={()=>onNavigate('revision')}>Open revision</button></div>}
function WeakAreas({onNavigate}) {return <div className="panel weak-panel"><div className="panel-head"><div><span className="eyebrow">LEARNING SIGNAL</span><h3>Strengthen these</h3></div><CircleAlert size={18}/></div><div className="weak-item"><div className="weak-ring red">52<small>%</small></div><div><strong>Recursion</strong><span>Test accuracy · 5 attempts</span></div><button onClick={()=>onNavigate('revision')}>Revise</button></div><div className="weak-item"><div className="weak-ring amber">61<small>%</small></div><div><strong>Pointers</strong><span>Test accuracy · 4 attempts</span></div><button onClick={()=>onNavigate('revision')}>Practice</button></div><p className="recommendation"><Sparkles size={15}/> One short revision + 5 targeted problems can improve this.</p></div>}

function Subjects({data,onAdd,onSubject,onRename,onDelete}) {
  const [openMenu,setOpenMenu] = useState(null);
  const [editSubject,setEditSubject] = useState(null);
  return <div className="enter">
    <section className="page-intro"><div><p className="muted">YOUR LEARNING MAP</p><h2>Everything you’re learning, <em>in one place.</em></h2><p>Create a subject first, then add modules, lessons, and material at your own pace.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17}/> Add subject</button></section>
    {data.subjects.length ? <><div className="filter-row"><button className="filter-active">All subjects <span>{data.subjects.length}</span></button><button>In progress</button><button>Completed</button><div className="spacer"/><button className="sort-button"><ListFilter size={16}/> Sort: recently active <ChevronDown size={15}/></button></div><div className="subject-card-grid">{data.subjects.map(s => <article className="subject-card" key={s.id}>
      <div className="subject-card-top"><span className="subject-symbol large" style={{color:s.color,background:`${s.color}15`}}>{s.icon}</span><div className="item-menu-anchor"><button className="icon-button" title="More options" onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === s.id ? null : s.id); }}><MoreHorizontal size={19}/></button>{openMenu === s.id && <ItemMenu onEdit={() => { setOpenMenu(null); setEditSubject(s); }} onDelete={() => { setOpenMenu(null); onDelete(s.id); }} />}</div></div>
      <p>{s.code}</p><h3>{s.name}</h3><span className="last-topic">Last: {s.last}</span><div className="card-progress"><div><span>Course progress</span><b>{s.progress}%</b></div><div className="progress-line"><i style={{...pct(s.progress),background:s.color}}/></div><small>{s.completed} of {s.lessons} lessons complete</small></div><button className="open-subject" onClick={() => onSubject(s)}>Open subject <ArrowRight size={16}/></button>
    </article>)}</div></> : <EmptyWorkspace icon={BookOpen} title="No subjects yet" description="Start with anything you want to learn — a programming language, a university subject, or a personal project." action="Create your first subject" onAction={onAdd}/>}<section className="architecture-callout"><div className="callout-icon"><Layers3 size={23}/></div><div><span className="eyebrow">FLEXIBLE BY DESIGN</span><h3>One subject can grow in many directions.</h3><p>Add modules, lessons, resources, practice sets, and tests only when you need them.</p></div><button className="ghost-button" onClick={onAdd}>Create a subject</button></section>
    {editSubject && <NameModal title="Rename subject" currentName={editSubject.name} onClose={() => setEditSubject(null)} onSubmit={name => { onRename(editSubject.id, name); setEditSubject(null); }} />}
  </div>;
}

function SubjectWorkspace({subject, data, onBack, onAddMaterial, onLesson}) {
  const materials = data.resources.filter(item => item.subject === subject.name && item.type !== 'FOLDER');
  const notes = data.notes.filter(note => note.subject === subject.name);
  const lessons = data.lessons.filter(lesson => lesson.subject === subject.name);

  const openMaterial = (material) => {
    if (material.url) {
      window.open(material.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (material.data) {
      const link = document.createElement('a');
      link.href = material.data;
      link.download = material.fileName || material.name || 'codera-material';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  return <div className="enter">
    <button className="back-button" onClick={onBack}>
      <ChevronLeft size={17}/> Back to subjects
    </button>

    <section className="panel" style={{padding:'24px',marginBottom:'14px',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'24px',flexWrap:'wrap'}}>
        <div style={{maxWidth:'720px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
            <div style={{width:'44px',height:'44px',borderRadius:'12px',display:'grid',placeItems:'center',background:`${subject.color}18`,color:subject.color,fontSize:'20px'}}>{subject.icon}</div>
            <div>
              <span className="eyebrow">SUBJECT WORKSPACE</span>
              <span style={{fontSize:'10px',color:'var(--muted)'}}>{subject.code}</span>
            </div>
          </div>
          <h2 style={{font:'700 28px Manrope',letterSpacing:'-0.8px',margin:'0 0 6px'}}>{subject.name}</h2>
          <p style={{fontSize:'12px',lineHeight:1.6,color:'var(--muted)',margin:0}}>
            Your personal learning space. Add notes, files, and useful links for this subject.
          </p>
        </div>
        <div style={{minWidth:'150px',padding:'15px 18px',border:'1px solid var(--line)',borderRadius:'11px',background:'var(--surface-2)',textAlign:'center'}}>
          <strong style={{display:'block',font:'700 24px Manrope',color:subject.color}}>{subject.progress}%</strong>
          <span style={{display:'block',fontSize:'10px',color:'var(--muted)',marginTop:'3px'}}>course progress</span>
        </div>
      </div>
    </section>

    <section style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'12px',marginBottom:'14px'}}>
      <button className="quick-card" onClick={() => onAddMaterial('note')} style={{textAlign:'left'}}>
        <div><NotebookPen size={19}/></div>
        <strong>Add note</strong>
        <span>Write explanations, examples, and reminders</span>
        <ArrowUpRight size={15}/>
      </button>
      <button className="quick-card" onClick={() => onAddMaterial('file')} style={{textAlign:'left'}}>
        <div><Upload size={19}/></div>
        <strong>Add file</strong>
        <span>Upload a PDF, document, image, or other file</span>
        <ArrowUpRight size={15}/>
      </button>
      <button className="quick-card" onClick={() => onAddMaterial('url')} style={{textAlign:'left'}}>
        <div><Link size={19}/></div>
        <strong>Add URL</strong>
        <span>Save a tutorial, website, or video link</span>
        <ArrowUpRight size={15}/>
      </button>
    </section>

    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.35fr) minmax(0,1fr)',gap:'14px'}}>
      <section className="panel" style={{padding:'18px'}}>
        <div className="panel-head">
          <div><span className="eyebrow">LEARNING MATERIAL</span><h3>Your material</h3></div>
          <span style={{font:'10px DM Mono',padding:'4px 7px',borderRadius:'6px',background:'var(--surface-3)',color:'var(--muted)'}}>{materials.length}</span>
        </div>
        {materials.length ? <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
          {materials.map(material => <button key={material.id} onClick={() => openMaterial(material)} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'10px',border:'1px solid transparent',borderRadius:'9px',background:'transparent',color:'var(--text)',textAlign:'left'}}>
            <div style={{width:'35px',height:'35px',borderRadius:'8px',display:'grid',placeItems:'center',flexShrink:0,background:`${material.tint || subject.color}18`,color:material.tint || subject.color}}>{material.type === 'URL' ? <Link size={18}/> : <FileText size={18}/>}</div>
            <div style={{flex:1,minWidth:0}}>
              <strong style={{display:'block',fontSize:'11px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{material.name}</strong>
              <span style={{display:'block',marginTop:'3px',fontSize:'9px',color:'var(--muted)'}}>{material.type}{material.size ? ` · ${material.size}` : ''}</span>
            </div>
            <ArrowUpRight size={16} style={{color:'var(--faint)'}}/>
          </button>)}
        </div> : <div className="empty-inline"><FileText size={18}/><span>No material yet. Add your first file or URL.</span></div>}
      </section>

      <section className="panel" style={{padding:'18px'}}>
        <div className="panel-head">
          <div><span className="eyebrow">YOUR NOTES</span><h3>Notes</h3></div>
          <button className="text-button" onClick={() => onAddMaterial('note')}>Add note <Plus size={14}/></button>
        </div>
        {notes.length ? <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
          {notes.map(note => <div key={note.id} style={{display:'flex',gap:'10px',padding:'10px',border:'1px solid var(--line-soft)',borderRadius:'9px',background:'var(--surface-2)'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'8px',display:'grid',placeItems:'center',flexShrink:0,background:'var(--brand-bg)',color:'var(--brand-light)'}}><NotebookPen size={17}/></div>
            <div style={{minWidth:0}}>
              <strong style={{display:'block',fontSize:'11px'}}>{note.title}</strong>
              <p style={{fontSize:'9px',lineHeight:1.5,color:'var(--muted)',margin:'4px 0',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{note.body || 'Empty note'}</p>
              <span style={{fontSize:'8px',color:'var(--faint)'}}>{note.updated}</span>
            </div>
          </div>)}
        </div> : <div className="empty-inline"><NotebookPen size={18}/><span>No notes yet. Create notes while studying.</span></div>}
      </section>
    </div>

    <section className="panel" style={{padding:'18px',marginTop:'14px'}}>
      <div className="panel-head">
        <div><span className="eyebrow">LEARNING PATH</span><h3>Lessons</h3></div>
        <span style={{font:'10px DM Mono',padding:'4px 7px',borderRadius:'6px',background:'var(--surface-3)',color:'var(--muted)'}}>{lessons.length}</span>
      </div>
      {lessons.length ? lessons.map((lesson,index) => <button key={lesson.id} onClick={() => onLesson(lesson)} style={{width:'100%',display:'flex',alignItems:'center',gap:'12px',padding:'11px 4px',border:0,borderTop:'1px solid var(--line-soft)',background:'transparent',color:'var(--text)',textAlign:'left'}}>
        <span style={{width:'25px',font:'10px DM Mono',color:'var(--faint)'}}>{String(index+1).padStart(2,'0')}</span>
        <div style={{flex:1}}><strong style={{display:'block',fontSize:'11px'}}>{lesson.title}</strong><small style={{display:'block',fontSize:'9px',color:'var(--muted)',marginTop:'3px'}}>{lesson.unit} · {lesson.duration}</small></div>
        <b style={{font:'10px DM Mono',color:lesson.color}}>{lesson.progress}%</b>
      </button>) : <div className="empty-inline"><GraduationCap size={18}/><span>No lessons yet. You can add structured lessons later.</span></div>}
    </section>
  </div>;
}

function SubjectMaterialModal({type, subject, onClose, onSubmit}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);

  const isNote = type === 'note';
  const isFile = type === 'file';
  const isUrl = type === 'url';

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="create-modal" onMouseDown={event => event.stopPropagation()} onSubmit={event => {
      event.preventDefault();
      onSubmit({ materialType: type, title, body, url, file, subject: subject.name });
    }}>
      <button type="button" className="modal-close" onClick={onClose}><X size={18}/></button>
      <div className="modal-icon">{isNote ? <NotebookPen size={22}/> : isFile ? <Upload size={22}/> : <Link size={22}/>}</div>
      <h2>{isNote ? 'Add note' : isFile ? 'Add file' : 'Add URL'}</h2>
      <p>This material will be connected to <strong>{subject.name}</strong>.</p>

      {isNote && <>
        <label>NOTE TITLE<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="For example: Python loops" required/></label>
        <label>NOTE CONTENT<textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your explanation, examples, or important points..." required/></label>
      </>}

      {isFile && <>
        <label>FILE NAME<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional custom name"/></label>
        <label>SELECT FILE<input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required/></label>
        {file && <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px',border:'1px solid var(--line)',borderRadius:'8px',background:'var(--surface-2)',fontSize:'10px',color:'var(--muted)'}}><FileText size={16}/><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</span></div>}
      </>}

      {isUrl && <>
        <label>TITLE<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="For example: Python official tutorial" required/></label>
        <label>URL<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." required/></label>
      </>}

      <button className="primary-button full" type="submit"><Plus size={16}/>{isNote ? 'Add note' : isFile ? 'Add file' : 'Add URL'}</button>
    </form>
  </div>;
}


function Lessons({data,onLesson,onNavigate}) {return <div className="enter"><section className="page-intro"><div><p className="muted">LEARNING LIBRARY</p><h2>Lessons with <em>momentum.</em></h2><p>Lessons will appear after you create a subject and add learning content.</p></div></section>{data.lessons.length ? <div className="lesson-list panel">{data.lessons.map((l,i)=><button className="lesson-row" onClick={()=>onLesson(l)} key={l.id}><div className="row-number">{String(i+1).padStart(2,'0')}</div><div className="lesson-info"><span>{l.subject} <i>·</i> {l.unit}</span><h3>{l.title}</h3></div><div className="lesson-meta"><Clock3 size={15}/>{l.duration}</div><div className="lesson-status"><div className="progress-line"><i style={{...pct(l.progress),background:l.color}}/></div><span>{l.progress}% complete</span></div><span className={cx('status-pill',l.status === 'Completed' && 'completed')}>{l.status}</span><ArrowRight size={18}/></button>)}</div> : <EmptyWorkspace icon={GraduationCap} title="No lessons yet" description="Create a subject first. Your lessons will then stay connected to notes, videos, code, practice, and tests." action="Go to subjects" onAction={()=>onNavigate('subjects')}/>}</div>}

function LessonRoom({lesson,onNavigate,onToast}) {const [tab,setTab]=useState('learn'); const [criteria,setCriteria]=useState([true,true,false,false,false]); const tabs=[['learn','Learn',BookOpen],['videos','Videos',Video],['code','Code',Code2],['notes','Notes',NotebookPen],['practice','Practice',Braces],['test','Test',ClipboardCheck]]; return <div className="lesson-room enter"><button className="back-button" onClick={()=>onNavigate('lessons')}><ChevronLeft size={17}/> Back to lessons</button><div className="lesson-hero"><div><span className="eyebrow" style={{color:lesson.color}}>{lesson.subject.toUpperCase()} · LESSON {lesson.number}</span><h2>{lesson.title}</h2><p>{lesson.unit} <i>·</i> {lesson.duration} <i>·</i> Last opened today</p></div><div className="lesson-hero-progress"><div className="progress-ring" style={{'--progress':`${lesson.progress * 3.6}deg`, '--accent':lesson.color}}><b>{lesson.progress}<small>%</small></b></div><span>Your progress</span></div></div><div className="lesson-tabs">{tabs.map(([id,label,Icon])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><Icon size={16}/>{label}</button>)}</div><div className="lesson-grid"><section className="lesson-content panel">{tab === 'learn' && <LearnContent lesson={lesson} onTab={setTab}/>} {tab === 'videos' && <VideoContent/>} {tab === 'code' && <MiniCode/>} {tab === 'notes' && <NotesContent/>} {tab === 'practice' && <PracticeContent/>} {tab === 'test' && <TestContent onToast={onToast}/>}</section><aside className="completion-panel"><span className="eyebrow">COMPLETION</span><h3>Finish this lesson</h3><p>Complete the requirements below to mark this lesson done.</p><div className="criteria">{['Read the lesson content','Watch required video','Complete practice problems','Take the lesson test','Score 70% or higher'].map((item,i)=><button onClick={()=>setCriteria(c=>c.map((v,j)=>j===i?!v:v))} key={item} className={criteria[i]?'met':''}><span>{criteria[i]&&<Check size={13}/>}</span>{item}</button>)}</div><div className="completion-summary"><div><span>{criteria.filter(Boolean).length}/5</span><small>requirements complete</small></div><div className="progress-line"><i style={{...pct(criteria.filter(Boolean).length*20),background:lesson.color}}/></div></div><button className="primary-button full" disabled={criteria.some(x=>!x)} onClick={()=>onToast('Lesson completed — your progress has been updated')}><CheckCircle2 size={16}/> Mark complete</button></aside></div></div>}
function LearnContent({lesson,onTab}){return <><div className="content-kicker"><BookOpen size={17}/><span>CONCEPT</span><span className="reading-time"><Clock3 size={14}/> 8 min read</span></div><h2>Understanding {lesson.title}</h2><p className="lead">A linked list stores elements as connected nodes rather than in adjacent memory locations. This makes growing and reorganizing a collection flexible, while giving us a useful foundation for more complex data structures.</p><div className="concept-card"><div className="concept-dot" style={{background:lesson.color}}/><div><strong>Core idea</strong><p>Each node contains a value and a reference to the next node. To insert a node, we carefully update those connections — without losing the rest of the list.</p></div></div><h3>Insertion at the beginning</h3><p>To place a new node at the head, set its <code>next</code> reference to the current head, then move the head reference to the new node. This is a constant-time operation.</p><div className="diagram"><span>HEAD</span><i>→</i><b>10</b><i>→</i><b>24</b><i>→</i><b>36</b><i>→</i><em>NULL</em></div><button className="inline-action" onClick={()=>onTab('code')}><Code2 size={16}/> Try it in the editor <ArrowRight size={15}/></button></>}
function VideoContent(){return <><div className="video-preview"><div className="play-large"><Play size={25} fill="currentColor"/></div><span>12:42</span></div><h2>Linked Lists: A visual introduction</h2><p className="lead">A carefully selected walkthrough of nodes, pointers, and the three insertion cases.</p><div className="resource-info"><Video size={18}/><div><strong>Required video</strong><span>Watched 08:14 of 12:42</span></div><button className="primary-button compact"><Play size={15}/> Resume</button></div></>}
function MiniCode(){return <><div className="code-toolbar"><span><Code2 size={16}/> insertion.c</span><span className="lang-chip">C</span></div><pre className="mini-editor"><code><i>01</i>{' '}<b>#include &lt;stdio.h&gt;</b>{'\n'}<i>02</i>{' '}<b>#include &lt;stdlib.h&gt;</b>{'\n\n'}<i>04</i>{' '}<span className="syntax-blue">void</span> insertAtHead(Node **head, <span className="syntax-blue">int</span> value) {'\n'}<i>05</i>{'   '}Node *node = malloc(<span className="syntax-blue">sizeof</span>(Node));{'\n'}<i>06</i>{'   '}node-&gt;data = value;{'\n'}<i>07</i>{'   '}node-&gt;next = *head;{'\n'}<i>08</i>{'   '}*head = node;{'\n'}<i>09</i>{'}'}</code></pre><div className="code-notice"><LockKeyhole size={16}/><span>Execution is connected through CODERA’s sandbox API. No code is run in the browser.</span></div></>}
function NotesContent(){return <><div className="content-kicker"><NotebookPen size={17}/><span>YOUR NOTES</span><button className="text-button">Edit note <PenLine size={14}/></button></div><h2>Linked list insertion cases</h2><p className="note-paper">There are three primary insertion positions: <mark>at head</mark>, after a specified node, and at tail. Always preserve the next reference before mutation.<br/><br/>For insertion after a node: newNode.next = current.next; current.next = newNode;</p><div className="tags"><span>#linked-list</span><span>#dsa</span><span>#implementation</span></div></>}
function PracticeContent(){return <><div className="content-kicker"><Braces size={17}/><span>PRACTICE SET</span><span className="reading-time">2 of 5 solved</span></div><h2>Apply what you learned</h2><div className="problem-list">{[['Insert Node at Head','Easy','Solved'],['Insert Node at Position','Medium','Attempted'],['Reverse a Linked List','Medium','Not attempted']].map(([title,difficulty,status])=><button key={title}><span className={cx('problem-state',status==='Solved'&&'solved')}>{status==='Solved'?<Check size={14}/>:<Circle size={14}/>}</span><div><strong>{title}</strong><span>{difficulty} · Linked list</span></div><em>{status}</em><ArrowRight size={16}/></button>)}</div></>}
function TestContent({onToast}){return <><div className="test-banner"><div className="test-badge"><ClipboardCheck size={21}/></div><div><span className="eyebrow">LESSON ASSESSMENT</span><h2>Linked List fundamentals</h2><p>10 questions · 15 minutes · 70% to pass</p></div></div><div className="test-stats"><span><HelpCircle size={16}/> Multiple choice</span><span><Code2 size={16}/> Code output</span><span><Braces size={16}/> Coding question</span></div><button className="primary-button" onClick={()=>onToast('Test session created — connect your backend to start attempts')}><Play size={16}/> Start lesson test</button></>}

function Library({data,onNew,onRename,onDelete}) {
  const [tab,setTab] = useState('All files');
  const [selectedFolder,setSelectedFolder] = useState(null);
  const [query,setQuery] = useState('');

  const folders = data.resources.filter(item => item.type === 'FOLDER');
  const currentItems = selectedFolder
    ? data.resources.filter(item => item.parentId === selectedFolder.id)
    : data.resources.filter(item => !item.parentId);
  const term = query.trim().toLowerCase();
  const filteredItems = currentItems
    .filter(item => !term || `${item.name} ${item.type} ${item.subject || ''} ${item.topic || ''}`.toLowerCase().includes(term))
    .filter(item => tab === 'Favorites' ? item.favorite : tab === 'Recent' ? true : true)
    .sort((a,b) => tab === 'Recent' ? ((b.createdAt || b.id || 0) - (a.createdAt || a.id || 0)) : 0);

  const breadcrumbFolders = [];
  let breadcrumbCursor = selectedFolder;
  while (breadcrumbCursor) {
    breadcrumbFolders.unshift(breadcrumbCursor);
    breadcrumbCursor = folders.find(folder => folder.id === breadcrumbCursor.parentId) || null;
  }

  const addFolder = () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    onNew({ type:'folder', title:name.trim(), parentId:selectedFolder?.id || null });
  };

  const addUrl = () => {
    const title = window.prompt('Link title');
    if (!title?.trim()) return;
    const url = window.prompt('URL');
    if (!url?.trim()) return;
    onNew({ type:'library-url', title:title.trim(), url:url.trim(), folderId:selectedFolder?.id || null });
  };

  const addFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onNew({ type:'library-file', folderId:selectedFolder?.id || null, file });
    };
    input.click();
  };

  const toggleFavorite = (event,item) => {
    event.stopPropagation();
    onRename('__favorite__', item.id, item.favorite ? '0' : '1');
  };

  const openItem = (item) => {
    if (item.type === 'FOLDER') {
      setSelectedFolder(item);
      setQuery('');
      setTab('All files');
      return;
    }
    if (item.url) {
      window.open(item.url,'_blank','noopener,noreferrer');
      return;
    }
    if (item.data) {
      const link = document.createElement('a');
      link.href = item.data;
      link.download = item.fileName || item.name || 'codera-material';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const rename = (item) => {
    const next = window.prompt('Rename item', item.name);
    if (next?.trim()) onRename('resource', item.id, next.trim());
  };

  const remove = (item) => {
    const message = item.type === 'FOLDER' ? `Delete "${item.name}" and everything inside it?` : `Delete "${item.name}"?`;
    if (window.confirm(message)) onDelete('resource', item.id);
  };

  const goBack = () => {
    if (!selectedFolder) return;
    const parent = folders.find(folder => folder.id === selectedFolder.parentId);
    setSelectedFolder(parent || null);
    setQuery('');
    setTab('All files');
  };

  const renderItem = (item) => <article className="library-row-card" key={item.id}>
    <button className="library-row-main" onClick={() => openItem(item)}>
      <div className="library-row-icon" style={{color:item.tint || 'var(--brand-light)',background:`${item.tint || '#8c7cff'}18`}}>
        {item.type === 'FOLDER' ? <FolderOpen size={19}/> : item.type === 'URL' ? <Link size={19}/> : <FileText size={19}/>} 
      </div>
      <div className="library-row-copy"><strong>{item.name}</strong><span>{item.type === 'FOLDER' ? `${data.resources.filter(child => child.parentId === item.id).length} items` : `${item.type} · ${item.size || 'Saved material'}`}</span></div>
      <small>{item.updated || 'Recently'}</small>
      {item.type === 'FOLDER' ? <ArrowRight size={17}/> : <ArrowUpRight size={17}/>} 
    </button>
    <div className="library-row-actions">
      {item.type !== 'FOLDER' && <button className={cx('icon-button',item.favorite && 'library-favorite-active')} title={item.favorite ? 'Remove favorite' : 'Add favorite'} onClick={event => toggleFavorite(event,item)}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'}/></button>}
      <button className="icon-button" title="Rename" onClick={() => rename(item)}><PenLine size={15}/></button>
      <button className="icon-button" title="Delete" onClick={() => remove(item)}><Trash2 size={15}/></button>
    </div>
  </article>;

  const headerTitle = selectedFolder ? selectedFolder.name : 'Your library';
  return <div className="enter">
    <section className="page-intro library-page-intro">
      <div>
        <p className="muted">SMART LIBRARY</p>
        <h2>{headerTitle}, <em>organized.</em></h2>
        <p>Store PDFs, documents, links, images, cheat sheets, books, and anything useful for your learning.</p>
      </div>
      <div className="button-row">
        {selectedFolder && <button className="ghost-button" onClick={goBack}><ChevronLeft size={16}/> Back</button>}
        <button className="ghost-button" onClick={addFolder}><FolderPlus size={16}/> New folder</button>
        <button className="ghost-button" onClick={addUrl}><Link size={16}/> Add link</button>
        <button className="primary-button" onClick={addFile}><Upload size={16}/> Upload file</button>
      </div>
    </section>

    {selectedFolder && <div className="library-breadcrumbs"><button onClick={() => setSelectedFolder(null)}>Library</button>{breadcrumbFolders.map((folder,index) => <React.Fragment key={folder.id}><ChevronRight size={14}/>{index === breadcrumbFolders.length - 1 ? <strong>{folder.name}</strong> : <button onClick={() => setSelectedFolder(folder)}>{folder.name}</button>}</React.Fragment>)}</div>}

    <section className="library-main panel">
      <div className="library-toolbar library-toolbar-enhanced">
        <div className="tabs">{['All files','Recent','Favorites'].map(t => <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t}{t === 'Favorites' && <span>{data.resources.filter(item => item.favorite).length}</span>}</button>)}</div>
        <label className="library-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this folder..."/></label>
      </div>

      {selectedFolder && <div className="library-folder-summary"><div><FolderOpen size={18}/><div><strong>{selectedFolder.name}</strong><span>{currentItems.length} item{currentItems.length === 1 ? '' : 's'} · Nested folders supported</span></div></div><button className="ghost-button compact" onClick={addFolder}><FolderPlus size={15}/> New subfolder</button></div>}

      {filteredItems.length ? <div className="library-row-list">{filteredItems.map(renderItem)}</div> : <div className="library-empty-state"><div className="library-empty-icon"><FolderOpen size={25}/></div><strong>{term ? 'No matching material' : tab === 'Favorites' ? 'No favorites yet' : selectedFolder ? 'This folder is empty' : 'Your library is ready'}</strong><span>{term ? 'Try another search term.' : selectedFolder ? 'Add a file, link, or subfolder to start organizing this topic.' : 'Create folders such as Python, College, DSA, PDFs, Cheat Sheets, or Books.'}</span><div className="button-row"><button className="ghost-button" onClick={addFolder}><FolderPlus size={15}/> New folder</button><button className="primary-button" onClick={addFile}><Upload size={15}/> Add file</button></div></div>}
    </section>

    {!selectedFolder && <section className="library-tip panel"><div className="library-tip-icon"><Layers3 size={19}/></div><div><strong>Keep Library and Lessons separate</strong><span>Library is your general knowledge storage. Link important material to a Subject or Lesson when you want it to become part of your active learning flow.</span></div></section>}
  </div>;
}

function Notes({data,onNew,setData}){
  const [selected,setSelected]=useState(data.notes[0]?.id);
  const [searchTerm,setSearchTerm]=useState('');
  const [filter,setFilter]=useState('all');
  const current=data.notes.find(n=>n.id===selected)||data.notes[0];
  const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState(current?.title||'');
  const [body,setBody]=useState(current?.body||'');

  useEffect(()=>{
    if(current){
      setTitle(current.title||'');
      setBody(current.body||'');
    }
    setEditing(false);
  },[selected,current?.id]);

  const filtered=data.notes.filter(note=>{
    const matchesSearch=!searchTerm || `${note.title} ${note.body} ${note.subject}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter=filter==='all' || (filter==='favorites' && note.favorite) || (filter==='lessons' && note.lessonId);
    return matchesSearch && matchesFilter;
  });

  const save=()=>{
    if(!current) return;
    setData(d=>({...d,notes:d.notes.map(n=>n.id===current.id?{...n,title:title.trim()||'Untitled note',body,updated:'Just now'}:n)}));
    setEditing(false);
  };

  const toggleFavorite=()=>{
    if(!current) return;
    setData(d=>({...d,notes:d.notes.map(n=>n.id===current.id?{...n,favorite:!n.favorite}:n)}));
  };

  const deleteNote=()=>{
    if(!current) return;
    if(!window.confirm(`Delete "${current.title}"?`)) return;
    const remaining=data.notes.filter(n=>n.id!==current.id);
    setData(d=>({...d,notes:remaining}));
    setSelected(remaining[0]?.id);
    setEditing(false);
  };

  if (!data.notes.length) return <div className="enter">
    <section className="page-intro"><div><p className="muted">PERSONAL KNOWLEDGE</p><h2>Notes that are <em>yours.</em></h2><p>Capture explanations, reminders, and ideas as you learn.</p></div></section>
    <EmptyWorkspace icon={NotebookPen} title="No notes yet" description="Create a note whenever you want to remember, explain, or revise something." action="Create your first note" onAction={onNew}/>
  </div>;

  return <div className="enter notes-layout notes-working">
    <aside className="notes-sidebar">
      <div className="notes-top"><div><span className="eyebrow">PERSONAL KNOWLEDGE</span><h2>Notes</h2></div><button className="primary-button compact" onClick={onNew}><Plus size={16}/></button></div>
      <div className="note-search"><Search size={15}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search notes"/></div>
      <div className="notes-filters">
        <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}><Inbox size={16}/> All notes <span>{data.notes.length}</span></button>
        <button className={filter==='favorites'?'active':''} onClick={()=>setFilter('favorites')}><Star size={16}/> Favorites <span>{data.notes.filter(n=>n.favorite).length}</span></button>
        <button className={filter==='lessons'?'active':''} onClick={()=>setFilter('lessons')}><BookMarked size={16}/> Linked to lessons</button>
      </div>
      <p className="notes-list-label">NOTES</p>
      <div className="notes-list">
        {filtered.length ? filtered.map(n=><button className={selected===n.id?'active':''} onClick={()=>setSelected(n.id)} key={n.id}><span style={{background:n.color||'#8d6f56'}}/><div><strong>{n.title}</strong><small>{n.subject||'General'} · {n.updated||'Recently'}</small></div>{n.favorite&&<Star size={14} fill="currentColor"/>}</button>)
        : <div className="notes-no-results"><Search size={16}/><span>No matching notes</span></div>}
      </div>
    </aside>

    <article className="note-editor panel">
      {current && <>
        <div className="editor-head">
          <div><span className="subject-tag">{current.subject||'General'}</span><span className="updated">Edited {current.updated||'Recently'}</span></div>
          <div className="note-editor-actions">
            <button className={cx('icon-button',current.favorite&&'note-favorite-active')} onClick={toggleFavorite} title={current.favorite?'Remove favorite':'Add favorite'}><Star size={17} fill={current.favorite?'currentColor':'none'}/></button>
            <button className="icon-button" onClick={deleteNote} title="Delete note"><Trash2 size={17}/></button>
          </div>
        </div>
        {editing
          ? <input className="note-title-input" value={title} onChange={e=>setTitle(e.target.value)} />
          : <input className="note-title-input" value={current.title} readOnly/>
        }
        <div className="markdown-tools">
          <button onClick={()=>setBody(v=>`${v}${v?'\\n\\n':''}# `)}>H</button>
          <button onClick={()=>setBody(v=>`${v} **bold**`)}><b>B</b></button>
          <button onClick={()=>setBody(v=>`${v}${v?'\\n':''}- `)}>•</button>
          <button onClick={()=>setBody(v=>`${v}${v?'\\n':''}- [ ] `)}>☑</button>
          <span/>
          {editing ? <button className="text-button" onClick={save}>Save changes</button> : <button className="text-button" onClick={()=>setEditing(true)}><PenLine size={14}/> Edit note</button>}
        </div>
        {editing
          ? <textarea className="note-edit-area" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your notes here…"/>
          : <div className="note-body">{(current.body||'').split('\n').map((p,i)=>p ? <p key={i}>{p}</p> : <br key={i}/>)}</div>}
        <div className="editor-foot">
          <div className="tags">{(current.tags||[]).map(t=><span key={t}>#{t}</span>)}</div>
          <span className="note-saved-status">{editing?'Unsaved changes':'Saved locally'}</span>
        </div>
      </>}
    </article>
  </div>;
}

function PaperclipIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}

function CodeStudio({data,setData,onToast}){
  const [language,setLanguage]=useState('C');
  const [title,setTitle]=useState('untitled.c');
  const [code,setCode]=useState('');
  const [output,setOutput]=useState('No output yet. Connect the secure compiler service before running code.');
  const [visualType,setVisualType]=useState('Array');
  const [visualStep,setVisualStep]=useState(0);
  const [visualRunning,setVisualRunning]=useState(false);

  const visualSteps={
    Array:['[10] [20] [30]','   ↑ current','i = 0','[10] [20] [30]','   ↑ current','i = 1'],
    'Linked List':['HEAD → [10] → [20] → [30]','       ↑ current','current = node 10','HEAD → [10] → [20] → [30]','              ↑ current','current = node 20'],
    Stack:['[ 30 ]','[ 20 ]','[ 10 ]','TOP ↑','pop() → 30','TOP ↑'],
    Queue:['FRONT → [10] [20] [30] ← REAR','FRONT → [20] [30] ← REAR','dequeue() → 10','FRONT → [30] ← REAR','dequeue() → 20','Queue updated'],
    Tree:['      8','     / \\','    4   12','visit(8)','      8','     / \\','  → 4   12'],
    Sorting:['[30] [10] [20]','compare 30 > 10','[10] [30] [20]','compare 30 > 20','[10] [20] [30]','sorted']
  };

  useEffect(()=>{
    if(!visualRunning) return;
    const timer=setInterval(()=>setVisualStep(step=>{
      const max=visualSteps[visualType].length-1;
      if(step>=max){setVisualRunning(false);return step;}
      return step+1;
    }),900);
    return ()=>clearInterval(timer);
  },[visualRunning,visualType]);

  const save=()=>{setData(d=>({...d,code:[{id:Date.now(),title:title||'untitled',language,folder:'Scratchpad',updated:'Just now',tags:[]},...d.code]}));onToast('Code saved to your workspace')};

  return <div className="enter studio">
    <section className="studio-head"><div><span className="eyebrow">CODING WORKSPACE</span><h2>Write, test, <em>understand.</em></h2></div><div className="button-row"><button className="ghost-button" disabled title="Compiler backend is not connected"><Play size={16}/> Run</button><button className="primary-button" onClick={save}><Save size={16}/> Save</button></div></section>

    <div className="studio-layout"><aside className="code-files panel"><div className="file-panel-head"><strong>My code</strong><button className="icon-button"><Plus size={16}/></button></div><div className="code-tree">{data.code.length ? <><span><ChevronDown size={14}/><FolderOpen size={16}/> Scratchpad</span>{data.code.map((f,i)=><button className={i===0?'active':''} key={f.id}><FileCode2 size={15}/>{f.title}</button>)}</> : <EmptyInline icon={FileCode2} text="No saved code yet."/>}</div></aside>

      <section className="editor-workspace panel">
        <div className="editor-top"><div className="editor-file"><FileCode2 size={16}/><input value={title} onChange={e=>setTitle(e.target.value)}/><i/></div><div><select value={language} onChange={e=>setLanguage(e.target.value)}>{['C','C++','Java','Python','JavaScript'].map(l=><option key={l}>{l}</option>)}</select><button className="icon-button"><MoreHorizontal size={18}/></button></div></div>
        <div className="editor-area"><div className="line-numbers">{code.split('\n').map((_,i)=><span key={i}>{i+1}</span>)}</div><textarea spellCheck="false" value={code} onChange={e=>setCode(e.target.value)} placeholder="Start writing code…" /></div>
        <div className="output-panel"><div><Terminal size={16}/><strong>Output</strong><span className="sandbox-chip"><LockKeyhole size={12}/> Compiler disabled</span><button onClick={()=>setOutput('Execution is disabled until a secure compiler backend is connected.')}>Clear</button></div><pre>{output}</pre></div>
      </section>
    </div>

    <section className="visual-execution panel">
      <div className="visual-execution-head"><div><span className="eyebrow">VISUAL CODE EXECUTION</span><h3>Watch the data structure change step by step.</h3><p>Local visual simulation only. CODERA does not execute arbitrary code in the browser.</p></div><div className="visual-controls"><select value={visualType} onChange={e=>{setVisualType(e.target.value);setVisualStep(0);setVisualRunning(false)}}>{Object.keys(visualSteps).map(item=><option key={item}>{item}</option>)}</select><button className="ghost-button compact" onClick={()=>{setVisualStep(0);setVisualRunning(false)}}><RotateCcw size={14}/> Reset</button><button className="primary-button compact" onClick={()=>setVisualRunning(v=>!v)}><Play size={14}/>{visualRunning?'Pause':'Play'}</button></div></div>
      <div className="visual-stage"><pre>{visualSteps[visualType][visualStep]}</pre><div className="visual-step-indicator">{visualStep+1} / {visualSteps[visualType].length}</div></div>
    </section>

    <div className="studio-hint"><LockKeyhole size={17}/><span><strong>Execution safety first.</strong> Run remains disabled. The Visual Code Execution panel is a deterministic animation for arrays, linked lists, stacks, queues, trees, and sorting.</span></div>
  </div>;
}

function Revision({data,setData,onToast}){const [reviewed,setReviewed]=useState([]); const doReview=(id)=>{setReviewed(x=>[...x,id]);onToast('Marked as reviewed — the next date will be scheduled based on your confidence')};return <div className="enter"><section className="page-intro"><div><p className="muted">SPACED REVISION</p><h2>Make knowledge <em>stick.</em></h2><p>One calm, focused queue built from lessons, tests, notes, and mistakes.</p></div><div className="review-count"><strong>{data.revision.length - reviewed.length}</strong><span>items due</span></div></section><div className="revision-top"><div className="revision-hero"><div><span className="eyebrow">TODAY'S QUEUE</span><h3>25 minutes to clear your revision.</h3><p>Start with topics that need a little more attention.</p><button className="primary-button" onClick={()=>doReview(data.revision.find(x=>!reviewed.includes(x.id))?.id)}><Play size={16}/> Start today’s revision</button></div><div className="revision-orbit"><RotateCcw size={48}/><span>4<br/><small>due</small></span></div></div><div className="revision-pulse panel"><span className="eyebrow">RETENTION PULSE</span><div><strong>82%</strong><span>Estimated retention</span></div><div className="pulse-bars">{[50,70,62,88,76,92,82].map((x,i)=><i style={{height:`${x}%`}} key={i}/>)}</div></div></div><div className="revision-list panel"><div className="panel-head"><div><span className="eyebrow">SCHEDULED ITEMS</span><h3>What to review</h3></div><button className="text-button">Customize schedule <Settings size={15}/></button></div>{data.revision.map(r=><div className={cx('revision-row',reviewed.includes(r.id)&&'reviewed')} key={r.id}><div className="revision-color" style={{background:r.color}}/><div><span>{r.type} · {r.due}</span><h3>{r.title}</h3></div><span className="level-tag" style={{color:r.color,background:`${r.color}14`}}>{r.level}</span><div className="confidence"><span>How did it feel?</span><button onClick={()=>doReview(r.id)}>Again</button><button onClick={()=>doReview(r.id)}>Good</button><button onClick={()=>doReview(r.id)}>Easy</button></div>{reviewed.includes(r.id)?<CheckCircle2 className="review-check" size={21}/>:<button className="icon-button" onClick={()=>doReview(r.id)}><ArrowRight size={17}/></button>}</div>)}</div></div>}

function Progress({data}){return <div className="enter"><section className="page-intro"><div><p className="muted">LEARNING ANALYTICS</p><h2>See the work behind your <em>growth.</em></h2><p>Honest signals from the learning activity you log in CODERA.</p></div><button className="ghost-button"><CalendarDays size={16}/> Last 30 days <ChevronDown size={15}/></button></section><div className="analytics-grid"><div className="panel activity-chart"><div className="panel-head"><div><span className="eyebrow">STUDY RHYTHM</span><h3>Weekly focus time</h3></div><div className="chart-legend"><i/> This week</div></div><div className="bar-chart">{[['M',45],['T',67],['W',38],['T',84],['F',58],['S',95],['S',72]].map(([d,h],i)=><div key={i}><span style={{height:`${h}%`}}><em>{h===95?'2h 12m':''}</em></span><small>{d}</small></div>)}</div></div><div className="panel mastery-panel"><span className="eyebrow">OVERALL LEARNING</span><div className="mastery-ring"><div><strong>54%</strong><span>mastery</span></div></div><p>Up 8% since last month</p><div className="mastery-breakdown"><span><i className="violet"/> Learn <b>68%</b></span><span><i className="blue"/> Practice <b>48%</b></span><span><i className="orange"/> Test <b>78%</b></span></div></div></div><div className="panel subject-progress-panel"><div className="panel-head"><div><span className="eyebrow">SUBJECT PROGRESS</span><h3>Your learning map</h3></div><button className="text-button">Full report <ArrowRight size={14}/></button></div>{data.subjects.map(s=><div className="analytics-subject" key={s.id}><div className="subject-symbol" style={{color:s.color,background:`${s.color}14`}}>{s.icon}</div><strong>{s.name}</strong><div className="progress-line"><i style={{...pct(s.progress),background:s.color}}/></div><b>{s.progress}%</b><span>{s.completed}/{s.lessons} lessons</span></div>)}</div><section className="achievements"><div><span className="eyebrow">MILESTONES</span><h3>Small wins. Real momentum.</h3></div><div>{[['🔥','Six-day streak','Keep showing up'],['✦','50 lessons completed','You’re building foundations'],['⌘','30 problems solved','Practice is becoming fluency']].map(([e,t,d])=><div className="achievement" key={t}><b>{e}</b><span><strong>{t}</strong><small>{d}</small></span></div>)}</div></section></div>}

function ComingSoon({page,onNavigate}){const label={roadmaps:'Roadmaps',videos:'Video library',practice:'Practice',tests:'Tests'}[page];const icon={roadmaps:Layers3,videos:Video,practice:Braces,tests:ClipboardCheck}[page];const Icon=icon;return <div className="coming-soon enter"><div className="coming-icon"><Icon size={27}/></div><span className="eyebrow">NEXT MODULE</span><h2>{label}, designed to connect.</h2><p>This module is already part of CODERA’s information architecture. Your subjects, lessons, resources, progress, and revision queue are ready to connect when you implement it.</p><div className="connect-flow"><span>Learn</span><ArrowRight/><span>Practice</span><ArrowRight/><span>Test</span><ArrowRight/><span>Improve</span></div><button className="primary-button" onClick={()=>onNavigate('dashboard')}><LayoutDashboard size={16}/> Back to dashboard</button></div>}

function Roadmaps({data,onNew,onOpen,onRename,onDelete}) {
  const [openMenu,setOpenMenu] = useState(null); const [editRoadmap,setEditRoadmap] = useState(null);
  return <div className="enter">
    <section className="page-intro"><div><p className="muted">LEARNING PATHS</p><h2>Plan the journey, <em>your way.</em></h2><p>Create a roadmap, open it, then build it with phases, information, images, links, and learning material.</p></div><button className="primary-button" onClick={onNew}><Plus size={17}/> New roadmap</button></section>
    {data.roadmaps.length ? <div className="roadmap-list">{data.roadmaps.map(roadmap => <article className="roadmap-card panel roadmap-card-clickable" key={roadmap.id}><button className="roadmap-open-area" onClick={() => onOpen(roadmap)}><div className="roadmap-card-icon"><Layers3 size={20}/></div><div><span className="eyebrow">ROADMAP</span><h3>{roadmap.title}</h3><p>{(roadmap.phases || []).length} phase{(roadmap.phases || []).length === 1 ? '' : 's'} · {roadmap.progress || 0}% complete</p></div><ArrowRight size={18}/></button><div className="item-menu-anchor roadmap-menu"><button className="icon-button" title="More options" onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === roadmap.id ? null : roadmap.id); }}><MoreHorizontal size={18}/></button>{openMenu === roadmap.id && <ItemMenu onEdit={() => { setOpenMenu(null); setEditRoadmap(roadmap); }} onDelete={() => { setOpenMenu(null); onDelete(roadmap.id); }} />}</div></article>)}</div> : <EmptyWorkspace icon={Layers3} title="No roadmaps yet" description="Create a roadmap, then open it to add phases, information, images, and links." action="Create a roadmap" onAction={onNew}/>} 
    {editRoadmap && <NameModal title="Rename roadmap" currentName={editRoadmap.title} onClose={() => setEditRoadmap(null)} onSubmit={name => { onRename(editRoadmap.id, name); setEditRoadmap(null); }} />}
  </div>;
}

function Videos({data,onNewFolder,onAddVideo,onOpen,onRename,onDelete}) {
  const [openMenu,setOpenMenu] = useState(null); const [editItem,setEditItem] = useState(null);
  const folders = data.videos.filter(item => item.type === 'folder');
  const videos = data.videos.filter(item => item.type !== 'folder');
  const unfiled = videos.filter(video => !video.folderId);
  return <div className="enter">
    <section className="page-intro"><div><p className="muted">VIDEO LIBRARY</p><h2>Videos, kept in <em>context.</em></h2><p>Make folders first, then open a folder and save videos with a name and URL.</p></div><div className="button-row"><button className="ghost-button" onClick={onNewFolder}><FolderPlus size={16}/> New folder</button><button className="primary-button" onClick={onAddVideo}><Plus size={17}/> Add video</button></div></section>
    <section className="media-section"><div className="section-title"><div><span className="eyebrow">VIDEO FOLDERS</span><h3>Your folders</h3></div></div>
      {folders.length ? <div className="folder-card-grid">{folders.map(folder => <article className="media-folder-card panel" key={folder.id}><button className="media-folder-open" onClick={() => onOpen(folder)}><div className="media-folder-icon"><FolderOpen size={22}/></div><div><strong>{folder.title}</strong><span>{videos.filter(video => video.folderId === folder.id).length} videos</span></div></button><div className="item-menu-anchor"><button className="icon-button" title="More options" onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === folder.id ? null : folder.id); }}><MoreHorizontal size={18}/></button>{openMenu === folder.id && <ItemMenu onEdit={() => { setOpenMenu(null); setEditItem({...folder,entityType:'video-folder'}); }} onDelete={() => { setOpenMenu(null); onDelete('video-folder', folder.id); }} />}</div></article>)}</div> : <div className="media-empty panel"><FolderPlus size={22}/><strong>No video folders yet</strong><span>Create a folder such as DSA, Python, or English Speaking.</span><button className="ghost-button" onClick={onNewFolder}><Plus size={15}/> Create folder</button></div>}
    </section>
    <section className="media-section"><div className="section-title"><div><span className="eyebrow">UNSORTED VIDEOS</span><h3>Videos not in a folder</h3></div></div>
      {unfiled.length ? <div className="video-list">{unfiled.map(video => <article className="video-card panel video-card-menu" key={video.id}><button className="video-open-area" onClick={() => video.url ? window.open(video.url,'_blank','noopener,noreferrer') : null}><div className="video-thumb"><Play size={20} fill="currentColor"/></div><div><span className="subject-tag">{video.subject || 'General'}</span><h3>{video.title}</h3><p>{video.status} · Added {video.updated}</p></div></button><div className="item-menu-anchor"><button className="icon-button" title="More options" onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === video.id ? null : video.id); }}><MoreHorizontal size={18}/></button>{openMenu === video.id && <ItemMenu onEdit={() => { setOpenMenu(null); setEditItem({...video,entityType:'video'}); }} onDelete={() => { setOpenMenu(null); onDelete('video', video.id); }} />}</div></article>)}</div> : <div className="media-empty panel"><Video size={22}/><strong>No unsorted videos</strong><span>Use Add video to save one now or create a folder first.</span><button className="primary-button" onClick={onAddVideo}><Plus size={15}/> Add video</button></div>}
    </section>
    {editItem && <NameModal title={editItem.entityType === 'video-folder' ? 'Rename video folder' : 'Rename video'} currentName={editItem.title} onClose={() => setEditItem(null)} onSubmit={name => { onRename(editItem.entityType, editItem.id, name); setEditItem(null); }} />}
  </div>;
}


function ItemMenu({onEdit,onDelete}) {
  return <div className="item-menu" onMouseDown={event => event.stopPropagation()}><button onClick={onEdit}><PenLine size={14}/> Edit name</button><button className="danger" onClick={onDelete}><Trash2 size={14}/> Delete</button></div>;
}

function NameModal({title,currentName,onClose,onSubmit}) {
  const [name,setName] = useState(currentName || '');
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="create-modal" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); const clean=name.trim(); if(clean) onSubmit(clean); }}><button type="button" className="modal-close" onClick={onClose}><X size={18}/></button><div className="modal-icon"><PenLine size={22}/></div><h2>{title}</h2><p>Update the name shown in CODERA.</p><label>NAME<input autoFocus value={name} onChange={event => setName(event.target.value)} /></label><button className="primary-button full" type="submit"><Save size={16}/> Save name</button></form></div>;
}

function VideoModal({folderId,folderName,subjects,onClose,onSubmit}) {
  const [title,setTitle] = useState(''); const [url,setUrl] = useState(''); const [subject,setSubject] = useState(subjects[0]?.name || 'General');
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="create-modal" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if(!title.trim() || !url.trim()) return; onSubmit({title:title.trim(),url:url.trim(),subject,folderId,folderName}); }}><button type="button" className="modal-close" onClick={onClose}><X size={18}/></button><div className="modal-icon"><Video size={22}/></div><h2>Add video</h2><p>{folderName ? <>Save this video inside <strong>{folderName}</strong>.</> : 'Save a video to your video library.'}</p><label>VIDEO NAME<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="For example: DSA Linked List lecture" required/></label><label>VIDEO URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://youtube.com/..." required/></label><label>SUBJECT<select value={subject} onChange={event => setSubject(event.target.value)}><option>General</option>{subjects.map(item => <option key={item.id}>{item.name}</option>)}</select></label><button className="primary-button full" type="submit"><Plus size={16}/> Add video</button></form></div>;
}

function VideoFolderWorkspace({folder,data,onBack,onAddVideo,onRename,onDelete}) {
  const videos = data.videos.filter(item => item.type !== 'folder' && item.folderId === folder.id);
  const [openMenu,setOpenMenu] = useState(null); const [editFolder,setEditFolder] = useState(null); const [editVideo,setEditVideo] = useState(null);
  return <div className="enter media-workspace"><button className="back-button" onClick={onBack}><ChevronLeft size={17}/> Back to video library</button><section className="media-workspace-hero panel"><div><div className="media-workspace-icon"><FolderOpen size={25}/></div><span className="eyebrow">VIDEO FOLDER</span><h2>{folder.title}</h2><p>{videos.length} saved video{videos.length === 1 ? '' : 's'}. Add each video with its name and URL.</p></div><div className="workspace-actions"><button className="ghost-button" onClick={() => setEditFolder(folder)}><PenLine size={15}/> Rename</button><button className="primary-button" onClick={onAddVideo}><Plus size={16}/> Add video</button><div className="item-menu-anchor"><button className="icon-button" onClick={() => setOpenMenu(openMenu === 'folder' ? null : 'folder')}><MoreHorizontal size={18}/></button>{openMenu === 'folder' && <ItemMenu onEdit={() => { setOpenMenu(null); setEditFolder(folder); }} onDelete={() => { setOpenMenu(null); onDelete(folder.id); }} />}</div></div></section>
    {videos.length ? <section className="video-list folder-video-list">{videos.map(video => <article className="video-card panel video-card-menu" key={video.id}><button className="video-open-area" onClick={() => video.url ? window.open(video.url,'_blank','noopener,noreferrer') : null}><div className="video-thumb"><Play size={20} fill="currentColor"/></div><div><span className="subject-tag">{video.subject || 'General'}</span><h3>{video.title}</h3><p>{video.url}</p></div><ArrowUpRight size={17}/></button><div className="item-menu-anchor"><button className="icon-button" title="More options" onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === video.id ? null : video.id); }}><MoreHorizontal size={18}/></button>{openMenu === video.id && <ItemMenu onEdit={() => { setOpenMenu(null); setEditVideo(video); }} onDelete={() => { setOpenMenu(null); onDelete('video', video.id); }} />}</div></article>)}</section> : <div className="media-empty panel"><Video size={23}/><strong>This folder is empty</strong><span>Add your first video with a name and URL.</span><button className="primary-button" onClick={onAddVideo}><Plus size={15}/> Add video</button></div>}
    {editFolder && <NameModal title="Rename video folder" currentName={editFolder.title} onClose={() => setEditFolder(null)} onSubmit={name => { onRename(editFolder.id,name); setEditFolder(null); }} />}
    {editVideo && <NameModal title="Rename video" currentName={editVideo.title} onClose={() => setEditVideo(null)} onSubmit={name => { onRename(editVideo.id,name); setEditVideo(null); }} />}
  </div>;
}

function RoadmapWorkspace({roadmap,data,onBack,onAdd,onOpenPhase,onRename,onDelete}) {
  const [menuOpen,setMenuOpen] = useState(false); const [editRoadmap,setEditRoadmap] = useState(null);
  const safeRoadmap = data.roadmaps.find(item => item.id === roadmap.id) || roadmap;
  const phases = safeRoadmap.phases || []; const items = safeRoadmap.items || []; const links = safeRoadmap.links || [];
  return <div className="enter roadmap-workspace"><button className="back-button" onClick={onBack}><ChevronLeft size={17}/> Back to roadmaps</button><section className="roadmap-hero panel"><div className="roadmap-hero-copy">{safeRoadmap.image ? <img className="roadmap-cover" src={safeRoadmap.image} alt=""/> : <div className="roadmap-cover roadmap-cover-empty"><Layers3 size={28}/></div>}<div><span className="eyebrow">ROADMAP WORKSPACE</span><h2>{safeRoadmap.title}</h2><p>{safeRoadmap.description || 'Build this roadmap with phases, images, links, and learning material.'}</p><div className="roadmap-meta"><span>{phases.length} phases</span><span>·</span><span>{items.length} items</span><span>·</span><span>{links.length} links</span></div></div></div><div className="workspace-actions"><button className="ghost-button" onClick={() => onAdd('image')}><Upload size={15}/> Add image</button><button className="ghost-button" onClick={() => onAdd('link')}><Link size={15}/> Add link</button><button className="primary-button" onClick={() => onAdd('phase')}><Plus size={16}/> Add phase</button><div className="item-menu-anchor"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={18}/></button>{menuOpen && <ItemMenu onEdit={() => { setMenuOpen(false); setEditRoadmap(safeRoadmap); }} onDelete={() => { setMenuOpen(false); onDelete(safeRoadmap.id); }} />}</div></div></section>
    <div className="roadmap-workspace-grid"><section className="panel roadmap-phases"><div className="panel-head"><div><span className="eyebrow">ROADMAP STRUCTURE</span><h3>Phases</h3></div><span className="subject-count">{phases.length}</span></div>{phases.length ? phases.map((phase,index)=><button className="roadmap-phase-row roadmap-phase-button" onClick={() => onOpenPhase(phase)} key={phase.id || index}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{phase.title}</strong><small>{phase.body ? 'Content saved' : 'Not started yet'}</small></div><ArrowRight size={16}/></button>) : <div className="subject-empty"><Layers3 size={22}/><strong>No phases yet</strong><span>Add a phase to start organizing the journey.</span><button className="ghost-button" onClick={() => onAdd('phase')}><Plus size={15}/> Add phase</button></div>}</section><section className="panel roadmap-materials"><div className="panel-head"><div><span className="eyebrow">PHASE CONTENT</span><h3>Keep notes inside phases</h3></div></div><div className="subject-empty roadmap-material-hint"><NotebookPen size={22}/><strong>Open a phase to write and organize it.</strong><span>Each phase has its own Notion-style notes, images, and links.</span></div></section></div>
    {editRoadmap && <NameModal title="Rename roadmap" currentName={editRoadmap.title} onClose={() => setEditRoadmap(null)} onSubmit={name => { onRename(editRoadmap.id,name); setEditRoadmap(null); }} />}
  </div>;
}


function RoadmapPhaseWorkspace({roadmap, phase, onBack, onSave}) {
  const [body, setBody] = useState(phase.body || '');
  const [image, setImage] = useState(phase.image || '');
  const [links, setLinks] = useState(phase.links || []);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    onSave(roadmap.id, phase.id, { body, image, links });
    setTimeout(() => setSaving(false), 350);
  };

  const addLink = () => {
    const title = linkTitle.trim();
    const url = linkUrl.trim();
    if (!title || !url) return;
    setLinks(current => [...current, { id: Date.now(), title, url }]);
    setLinkTitle('');
    setLinkUrl('');
  };

  const removeLink = (id) => setLinks(current => current.filter(link => link.id !== id));

  const addImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  return <div className="enter phase-editor-page">
    <div className="phase-editor-top">
      <button className="back-button" onClick={onBack}><ChevronLeft size={17}/> Back to {roadmap.title}</button>
      <button className="primary-button" onClick={handleSave}><Save size={15}/>{saving ? 'Saved' : 'Save phase'}</button>
    </div>

    <section className="phase-editor-header panel">
      <div className="phase-editor-number">
        PHASE {String((roadmap.phases || []).findIndex(p => p.id === phase.id) + 1).padStart(2,'0')}
      </div>
      <div>
        <span className="eyebrow">ROADMAP NOTEBOOK</span>
        <h2>{phase.title}</h2>
        <p>Write everything you need for this phase. Your content stays attached to this phase.</p>
      </div>
    </section>

    <div className="phase-editor-grid">
      <main className="phase-notepad panel">
        <div className="notepad-toolbar">
          <div className="notepad-toolset">
            <button title="Heading" onClick={() => setBody(current => `${current}${current ? '\n\n' : ''}## `)}>H</button>
            <button title="Bold" onClick={() => setBody(current => `${current} **bold**`)}>B</button>
            <button title="Checklist" onClick={() => setBody(current => `${current}${current ? '\n' : ''}- [ ] `)}>☑</button>
            <button title="Bullet" onClick={() => setBody(current => `${current}${current ? '\n' : ''}- `)}>•</button>
          </div>
          <span>Markdown-friendly notes</span>
        </div>
        <textarea
          className="phase-notepad-textarea"
          value={body}
          onChange={event => setBody(event.target.value)}
          placeholder={`Start writing about "${phase.title}"…

Concepts to learn
Important definitions
Examples
Code snippets
Mistakes to avoid
Things to revise`}
          spellCheck="true"
        />
        {image && <div className="phase-image-preview"><img src={image} alt={`${phase.title} reference`} /><button className="icon-button" onClick={() => setImage('')} title="Remove image"><Trash2 size={16}/></button></div>}
      </main>

      <aside className="phase-side">
        <section className="panel phase-side-card">
          <div className="panel-head"><div><span className="eyebrow">REFERENCE</span><h3>Add image</h3></div><Upload size={17}/></div>
          <label className="phase-upload">
            <Upload size={20}/>
            <strong>{image ? 'Replace image' : 'Upload image'}</strong>
            <span>Diagram, screenshot, handwritten note, or reference image.</span>
            <input type="file" accept="image/*" onChange={event => addImage(event.target.files?.[0])}/>
          </label>
        </section>

        <section className="panel phase-side-card">
          <div className="panel-head"><div><span className="eyebrow">RESOURCES</span><h3>Links</h3></div><Link size={17}/></div>
          <div className="phase-link-form">
            <input value={linkTitle} onChange={event => setLinkTitle(event.target.value)} placeholder="Link title"/>
            <input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://..." type="url"/>
            <button type="button" className="ghost-button full" onClick={addLink}><Plus size={15}/> Add link</button>
          </div>
          {links.length ? <div className="phase-link-list">{links.map(link => <div className="phase-link-row" key={link.id}><div><strong>{link.title}</strong><span>{link.url}</span></div><button className="icon-button" onClick={() => removeLink(link.id)} title="Remove link"><Trash2 size={14}/></button></div>)}</div> : <div className="phase-side-empty"><Link size={18}/><span>No links added yet.</span></div>}
        </section>

        <section className="panel phase-side-card phase-save-card">
          <span className="eyebrow">READY</span>
          <strong>Everything in this phase is saved with the roadmap.</strong>
          <button className="primary-button full" onClick={handleSave}><Save size={15}/> Save changes</button>
        </section>
      </aside>
    </div>
  </div>;
}

function RoadmapContentModal({type,roadmapId,onClose,onSubmit}) {
  const [title,setTitle] = useState(''); const [body,setBody] = useState(''); const [url,setUrl] = useState(''); const [phase,setPhase] = useState(''); const [file,setFile] = useState(null);
  const submit = event => { event.preventDefault(); if(type==='info'){ onSubmit({roadmapId,description:body,item:{type:'info',title:title || 'Information',body}}); return; } if(type==='phase'){ onSubmit({roadmapId,phase:phase.trim() || 'New phase'}); return; } if(type==='link'){ onSubmit({roadmapId,link:{id:Date.now(),title:title.trim() || 'Saved link',url:url.trim()}}); return; } if(type==='image' && file){ const reader=new FileReader(); reader.onload=()=>onSubmit({roadmapId,image:reader.result,item:{type:'image',title:title.trim() || file.name,body:'',data:reader.result}}); reader.readAsDataURL(file); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="create-modal" onMouseDown={event => event.stopPropagation()} onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X size={18}/></button><div className="modal-icon">{type==='phase'?<Layers3 size={22}/>:type==='link'?<Link size={22}/>:type==='image'?<Upload size={22}/>:<FileText size={22}/>}</div><h2>{type==='phase'?'Add phase':type==='link'?'Add link':type==='image'?'Add image':'Add information'}</h2><p>Build this roadmap a little at a time.</p>{type==='info' && <><label>TITLE<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="For example: Start with C basics" required/></label><label>INFORMATION<textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Write the important information..." required/></label></>}{type==='phase' && <label>PHASE NAME<input autoFocus value={phase} onChange={event => setPhase(event.target.value)} placeholder="For example: Foundations" required/></label>}{type==='link' && <><label>LINK NAME<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="For example: Python official docs" required/></label><label>URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." required/></label></>}{type==='image' && <><label>IMAGE TITLE<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="Optional image name"/></label><label>SELECT IMAGE<input type="file" accept="image/*" onChange={event => setFile(event.target.files?.[0] || null)} required/></label>{file && <div className="selected-file"><FileText size={17}/><span>{file.name}</span></div>}</>}<button className="primary-button full" type="submit"><Plus size={16}/>{type==='phase'?'Add phase':type==='link'?'Add link':type==='image'?'Add image':'Add information'}</button></form></div>;
}
function ExamPreparation({data,selectedExam,onOpen,onNew,onDelete}) {
  const exams = [...(data.exams || [])].sort((a,b) => {
    const da = daysRemaining(a.date);
    const db = daysRemaining(b.date);
    const pastA = da < 0 ? 1 : 0;
    const pastB = db < 0 ? 1 : 0;
    return pastA - pastB || new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31');
  });
  const current = selectedExam ? exams.find(item => item.id === selectedExam.id) || selectedExam : exams[0];
  const upcoming = exams.filter(exam => daysRemaining(exam.date) >= 0);
  const past = exams.filter(exam => daysRemaining(exam.date) < 0);
  const days = current ? daysRemaining(current.date) : 0;

  const deleteCurrent = () => {
    if (!current) return;
    if (!window.confirm(`Delete "${current.name}"?`)) return;
    onDelete(current.id);
  };

  if (!exams.length) return <div className="enter">
    <section className="page-intro">
      <div><p className="muted">EXAM COUNTDOWN</p><h2>Keep your exams <em>clear.</em></h2><p>Add an exam date and syllabus topics. CODERA keeps the countdown and your exam list together.</p></div>
      <button className="primary-button" onClick={onNew}><Plus size={17}/> Add exam</button>
    </section>
    <EmptyWorkspace icon={CalendarDays} title="No exams yet" description="Create an exam to track its date and remaining days." action="Create your first exam" onAction={onNew}/>
  </div>;

  return <div className="enter exam-page">
    <section className="page-intro">
      <div><p className="muted">EXAM COUNTDOWN</p><h2>Your upcoming <em>exams.</em></h2><p>Keep each exam date, countdown, and syllabus in one simple place.</p></div>
      <button className="primary-button" onClick={onNew}><Plus size={17}/> Add exam</button>
    </section>

    <div className="exam-layout">
      <aside className="exam-sidebar panel">
        <div className="exam-sidebar-head"><div><span className="eyebrow">EXAM LIST</span><h3>Upcoming Exams</h3></div><span>{upcoming.length}</span></div>
        <div className="exam-list">
          {upcoming.length ? upcoming.map(exam => {
            const remaining = daysRemaining(exam.date);
            return <button key={exam.id} className={cx('exam-list-row',current?.id === exam.id && 'active')} onClick={() => onOpen(exam)}>
              <span><strong>{exam.name}</strong><small>{formatExamDate(exam.date)}</small></span>
              <b>{remaining === 0 ? 'Today' : `${remaining}d`}</b>
            </button>;
          }) : <div className="exam-section-empty"><CalendarDays size={17}/><span>No upcoming exams.</span></div>}
        </div>
        {past.length > 0 && <>
          <div className="exam-sidebar-divider" />
          <div className="exam-sidebar-head"><div><span className="eyebrow">HISTORY</span><h3>Past Exams</h3></div><span>{past.length}</span></div>
          <div className="exam-list">{past.map(exam => <button key={exam.id} className={cx('exam-list-row',current?.id === exam.id && 'active')} onClick={() => onOpen(exam)}><span><strong>{exam.name}</strong><small>{formatExamDate(exam.date)}</small></span><b>Past</b></button>)}</div>
        </>}
      </aside>

      <section className="exam-workspace">
        <div className="exam-hero panel">
          <div className="exam-hero-copy"><span className="eyebrow">{days < 0 ? 'EXAM COMPLETED' : days === 0 ? 'EXAM TODAY' : 'UPCOMING EXAM'}</span><h3>{current.name}</h3><p>{formatExamDate(current.date)}</p></div>
          <div className="exam-countdown-badge"><strong>{days < 0 ? Math.abs(days) : days}</strong><span>{days < 0 ? 'DAYS AGO' : days === 0 ? 'TODAY' : 'DAYS REMAINING'}</span></div>
        </div>

        <div className="exam-stat-grid">
          <div className="exam-mini-stat"><CalendarDays size={17}/><div><span>Exam date</span><strong>{formatExamDate(current.date)}</strong></div></div>
          <div className="exam-mini-stat"><Clock3 size={17}/><div><span>Countdown</span><strong>{days < 0 ? `${Math.abs(days)} days ago` : days === 0 ? 'Today' : `${days} days left`}</strong></div></div>
          <div className="exam-mini-stat"><BookOpen size={17}/><div><span>Syllabus topics</span><strong>{(current.topics || []).length}</strong></div></div>
        </div>

        <section className="exam-section panel">
          <div className="panel-head"><div><span className="eyebrow">SYLLABUS</span><h3>Topics to cover</h3></div><span className="exam-section-count">{(current.topics || []).length} topics</span></div>
          {(current.topics || []).length ? <div className="exam-topics">{current.topics.map((topic,index) => <div className="exam-topic" key={`${topic}-${index}`}><span>{index + 1}</span><strong>{topic}</strong></div>)}</div> : <div className="exam-section-empty"><BookOpen size={18}/><span>No syllabus topics added for this exam.</span></div>}
        </section>

        <section className="exam-actions panel"><div><span className="eyebrow">EXAM</span><strong>{current.name}</strong><span>{days < 0 ? 'This exam has passed.' : days === 0 ? 'This exam is today.' : `${days} days remaining.`}</span></div><div className="button-row"><button className="ghost-button" onClick={() => onOpen(null)}><X size={15}/> Close</button><button className="ghost-button danger-button" onClick={deleteCurrent}><Trash2 size={15}/> Delete exam</button></div></section>
      </section>
    </div>
  </div>;
}

function InterviewMode({mode,setMode,onToast}){
  const questions=interviewQuestions[mode]||interviewQuestions.DSA;
  const [index,setIndex]=useState(0);
  const [answer,setAnswer]=useState('');
  const [results,setResults]=useState([]);
  const [finished,setFinished]=useState(false);

  useEffect(()=>{setIndex(0);setAnswer('');setResults([]);setFinished(false)},[mode]);

  const submit=()=>{
    const question=questions[index];
    const words=answer.toLowerCase();
    const hits=question.keys.filter(key=>words.includes(key.toLowerCase())).length;
    const score=Math.min(10,Math.max(2,Math.round((hits/question.keys.length)*10)));
    const nextResults=[...results,{score,area:question.area}];
    setResults(nextResults);
    setAnswer('');
    if(index===questions.length-1){
      setFinished(true);
      onToast('Interview completed');
    }else{
      setIndex(v=>v+1);
    }
  };

  const restart=()=>{setIndex(0);setAnswer('');setResults([]);setFinished(false)};

  if(finished){
    const total=Math.round(results.reduce((sum,r)=>sum+r.score,0)/Math.max(results.length,1)*10);
    const weak=[...new Map(results.map(r=>[r.area,r])).values()].filter(r=>r.score<6).map(r=>r.area);
    return <div className="enter interview-page">
      <section className="interview-result panel">
        <div className="interview-result-icon"><Trophy size={28}/></div>
        <span className="eyebrow">INTERVIEW COMPLETE</span>
        <h2>{mode} interview score</h2>
        <strong className="interview-score">{total}%</strong>
        <p>Review the weak areas below and practice them before your next interview.</p>
        <div className="interview-result-grid"><div><span>Questions</span><strong>{results.length}</strong></div><div><span>Average score</span><strong>{Math.round(total/10)}/10</strong></div><div><span>Mode</span><strong>{mode}</strong></div></div>
        <div className="weak-area-box"><span className="eyebrow">WEAK AREAS</span>{weak.length ? weak.map(area=><span key={area}>{area}</span>) : <span>Keep practicing for higher consistency.</span>}</div>
        <div className="button-row"><button className="ghost-button" onClick={restart}><RotateCcw size={15}/> Try again</button><button className="primary-button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>Review preparation</button></div>
      </section>
    </div>;
  }

  const current=questions[index];
  return <div className="enter interview-page">
    <section className="page-intro">
      <div><p className="muted">INTERVIEW MODE</p><h2>Practice like a <em>real interview.</em></h2><p>Choose a track. CODERA asks one question at a time and gives a quick local score.</p></div>
    </section>
    <div className="interview-mode-tabs">{Object.keys(interviewQuestions).map(item=><button key={item} className={mode===item?'active':''} onClick={()=>setMode(item)}>{item}</button>)}</div>
    <section className="interview-card panel">
      <div className="interview-top"><span>QUESTION {index+1} / {questions.length}</span><span>{mode}</span></div>
      <div className="interviewer-bubble"><div className="interviewer-avatar"><Bot size={20}/></div><div><strong>Interviewer</strong><p>{current.q}</p></div></div>
      <textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Type your answer as if you were speaking to an interviewer…"/>
      <div className="interview-footer"><span>Include the key ideas you would say aloud.</span><button className="primary-button" disabled={!answer.trim()} onClick={submit}><ArrowRight size={16}/> Submit answer</button></div>
    </section>
  </div>;
}

function CleanRevision({data,onNavigate}) { return <div className="enter"><section className="page-intro"><div><p className="muted">SPACED REVISION</p><h2>Make knowledge <em>stick.</em></h2><p>Your revision queue will be built from lessons, tests, notes, and mistakes.</p></div><div className="review-count"><strong>{data.revision.length}</strong><span>items due</span></div></section>{data.revision.length ? <section className="revision-list panel">{data.revision.map(item=><div className="revision-row" key={item.id}><div className="revision-color" style={{background:item.color}}/><div><span>{item.type} · {item.due}</span><h3>{item.title}</h3></div><span className="level-tag" style={{color:item.color,background:`${item.color}14`}}>{item.level}</span><button className="icon-button"><ArrowRight size={17}/></button></div>)}</section> : <EmptyWorkspace icon={RotateCcw} title="Nothing to revise yet" description="Revision starts automatically after you add learning material, complete lessons, or save mistakes." action="Explore subjects" onAction={()=>onNavigate('subjects')}/>}</div>}

function CleanProgress({data,onNavigate}) { const count = data.subjects.length; return <div className="enter"><section className="page-intro"><div><p className="muted">LEARNING ANALYTICS</p><h2>Progress built from <em>real activity.</em></h2><p>CODERA will only show progress based on the work you actually log.</p></div></section>{count ? <section className="panel subject-progress-panel"><div className="panel-head"><div><span className="eyebrow">SUBJECT PROGRESS</span><h3>Your learning map</h3></div></div>{data.subjects.map(s=><div className="analytics-subject" key={s.id}><div className="subject-symbol" style={{color:s.color,background:`${s.color}14`}}>{s.icon}</div><strong>{s.name}</strong><div className="progress-line"><i style={{...pct(s.progress),background:s.color}}/></div><b>{s.progress}%</b><span>{s.completed}/{s.lessons} lessons</span></div>)}</section> : <EmptyWorkspace icon={ChartNoAxesCombined} title="No progress to show yet" description="When you create subjects and complete learning activities, your personal analytics will appear here." action="Create a subject" onAction={()=>onNavigate('subjects')}/>}</div>}

function SearchPalette({data,query,setQuery,onClose,onNavigate,onLesson}){const term=query.toLowerCase();const items=[...data.subjects.map(x=>({type:'Subject',title:x.name,icon:BookOpen,action:()=>onNavigate('subjects')})),...data.lessons.map(x=>({type:'Lesson',title:x.title,icon:GraduationCap,action:()=>onLesson(x)})),...data.notes.map(x=>({type:'Note',title:x.title,icon:NotebookPen,action:()=>onNavigate('notes')})),...data.resources.map(x=>({type:'File',title:x.name,icon:FileText,action:()=>onNavigate('library')})),...data.code.map(x=>({type:'Code',title:x.title,icon:Code2,action:()=>onNavigate('coding')}))].filter(x=>!term||x.title.toLowerCase().includes(term));return <div className="modal-backdrop search-backdrop" onMouseDown={onClose}><div className="search-palette" onMouseDown={e=>e.stopPropagation()}><div className="palette-input"><Search size={20}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search lessons, notes, code, files..."/><kbd>ESC</kbd></div><div className="palette-results">{items.length?items.slice(0,7).map((item,i)=><button key={i} onClick={()=>{item.action();onClose()}}><div><item.icon size={17}/></div><span><strong>{item.title}</strong><small>{item.type}</small></span><ArrowUpRight size={15}/></button>):<div className="empty-result">No items found in your learning space.</div>}</div><div className="palette-foot"><span><kbd>↑↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span>Searches all connected learning content</span></div></div></div>}
function CreateModal({type,onClose,onSubmit}){const labels={note:['New note','Give your thought a home. You can connect it to a lesson after creating it.','Note title'],folder:['New folder','Folders keep your resources easy to find.','Folder name'],subject:['New subject','Start a flexible workspace for any topic you want to learn.','Subject name']};const [title,setTitle]=useState('');const [body,setBody]=useState('');const [heading,sub,placeholder]=labels[type]||labels.note;return <div className="modal-backdrop" onMouseDown={onClose}><form className="create-modal" onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();onSubmit(type,{title,body})}}><button type="button" className="modal-close" onClick={onClose}><X size={18}/></button><div className="modal-icon">{React.createElement(actionIcons[type]||NotebookPen,{size:22})}</div><h2>{heading}</h2><p>{sub}</p><label>NAME<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder={placeholder}/></label>{type==='note'&&<label>START WRITING <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="A thought, a useful snippet, an explanation…"/></label>}<label className="select-label">{type==='note'?'SUBJECT':'LOCATION'}<select><option>{type==='note'?'General':'My library'}</option><option>Data Structures</option><option>Java Programming</option></select></label><button className="primary-button full" type="submit"><Plus size={16}/> Create {type}</button></form></div>}

function SimpleCreateModal({type,onClose,onSubmit}) {
  const setup={
    note:{title:'New note',description:'Capture a thought, explanation, or reminder.',placeholder:'Note title',icon:NotebookPen},
    task:{title:'Add daily task',description:'Add a task to today’s learning plan.',placeholder:'Task name',icon:CheckCircle2},
    folder:{title:'New folder',description:'Create a folder for material.',placeholder:'Folder name',icon:FolderPlus},
    subject:{title:'New subject',description:'Start a workspace for any topic you want to learn.',placeholder:'Subject name',icon:BookOpen},
    'video-folder':{title:'New video folder',description:'Create a folder for a group of videos.',placeholder:'Folder name',icon:FolderOpen},
    exam:{title:'Add exam',description:'Create a countdown and preparation plan.',placeholder:'Exam name',icon:CalendarDays},
    roadmap:{title:'New roadmap',description:'Create a roadmap, then open it to add phases, images, links, and learning material.',placeholder:'Roadmap name',icon:Layers3}
  }[type] || {};
  const Icon=setup.icon || NotebookPen;
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [phase,setPhase]=useState('');
  const [subject,setSubject]=useState('General');
  const [status,setStatus]=useState('Not started');
  const [date,setDate]=useState('');
  const [topics,setTopics]=useState('');
  const submit=(event)=>{
    event.preventDefault();
    onSubmit(type,{title,body,phase,subject,status,task:title,date,topics:topics.split(',').map(x=>x.trim()).filter(Boolean)});
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="create-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose}><X size={18}/></button>
      <div className="modal-icon"><Icon size={22}/></div>
      <h2>{setup.title}</h2><p>{setup.description}</p>
      <label>{type==='task'?'TASK':'NAME'}<input autoFocus value={title} onChange={event=>setTitle(event.target.value)} placeholder={setup.placeholder} required/></label>
      {type==='exam' && <>
        <label>EXAM DATE<input type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label>
        <label>TOPICS <small>(optional, comma separated)</small><textarea value={topics} onChange={event=>setTopics(event.target.value)} placeholder="Arrays, Linked List, Stack, Queue, Trees…"/></label>
      </>}
      {type==='task' && <label>SUBJECT<input value={subject} onChange={event=>setSubject(event.target.value)} placeholder="Python, DSA, English Speaking…"/></label>}
      {type==='task' && <label>STATUS<select value={status} onChange={event=>setStatus(event.target.value)}><option>Not started</option><option>In progress</option><option>Done</option></select></label>}
      {type==='note' && <label>CONTENT<textarea value={body} onChange={event=>setBody(event.target.value)} placeholder="Start writing…"/></label>}
      {type==='roadmap' && <label>FIRST PHASE <small>(optional)</small><input value={phase} onChange={event=>setPhase(event.target.value)} placeholder="For example: Foundations"/></label>}
      <button className="primary-button full" type="submit"><Plus size={16}/>{type==='task'?'Add task':type==='exam'?'Create preparation plan':type==='roadmap'?'Create roadmap':type==='video-folder'?'Create folder':`Create ${type}`}</button>
    </form>
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
