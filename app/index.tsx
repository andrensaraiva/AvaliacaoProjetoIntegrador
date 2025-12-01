import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, 
  Trash2, 
  Save, 
  Info, 
  BarChart3, 
  Settings, 
  PenTool, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Users,
  Award,
  ArrowLeft,
  FolderPlus,
  Layout,
  User,
  LogOut,
  Shield,
  UserCheck,
  Lock,
  CheckCircle2,
  Calendar,
  Check,
  CalendarX,
  CheckCircle,
  Moon,
  Sun,
  Rocket,
  Zap,
  Lightbulb,
  Globe,
  Code,
  Cpu,
  Beaker,
  Book,
  Briefcase,
  Target,
  Star,
  Smile,
  Gamepad,
  Music,
  Heart,
  Upload,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { syncEvaluationToFirebase, syncStructureSnapshot, isFirebaseConfigured, fetchStructureSnapshot, fetchEvaluationsSnapshot, fetchAdminPassword, saveAdminPassword } from './firebaseClient';

// --- Types ---

type Event = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  icon?: string;
  responseDeadline?: string; // YYYY-MM-DD
  description?: string;
};

type Criterion = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  weight: number; 
};

type Member = {
  id: string;
  name: string;
  icon?: string;
};

type Group = {
  id: string;
  eventId: string;
  name: string;
  icon?: string;
  members: Member[];
};

type Evaluation = {
  id: string;
  eventId: string;
  groupId: string;
  evaluatorName: string;
  scores: Record<string, number>; // criterionId -> score (0-10)
  individualScores: Record<string, number>; // memberId -> score (0-10)
  groupComment?: string;
  timestamp: number;
};

type Role = 'admin' | 'evaluator' | null;
type AdminView = 'dashboard' | 'config';
type ToastType = 'success' | 'error' | 'info';
type ToastMessage = { id: number; type: ToastType; message: string } | null;
type ModalMessage = { id: number; type: ToastType; title: string; message: string } | null;
type FeedbackVariant = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  toastClass: string;
  modalIconClass: string;
  modalButtonClass: string;
};

// --- Icon Mapping ---

const ICON_MAP: Record<string, any> = {
  Rocket, Zap, Lightbulb, Globe, Code, Cpu, Beaker, Book, Briefcase, Target, Star, Smile, Gamepad, Music, Heart, Calendar, Users, User, Award, ImageIcon
};

const AVAILABLE_ICONS = ['Rocket', 'Zap', 'Lightbulb', 'Globe', 'Code', 'Cpu', 'Beaker', 'Target', 'Star', 'Book', 'Briefcase', 'Gamepad', 'Music', 'Heart'];
const MEMBER_ICON_CHOICES = ['User', 'Star', 'Smile', 'Heart', 'Code', 'Beaker'];

const FEEDBACK_VARIANTS: Record<ToastType, FeedbackVariant> = {
  success: {
    icon: CheckCircle,
    toastClass: 'bg-emerald-600/90 border-emerald-500 text-white',
    modalIconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    modalButtonClass: 'bg-emerald-600 hover:bg-emerald-700',
  },
  error: {
    icon: AlertTriangle,
    toastClass: 'bg-red-600/90 border-red-500 text-white',
    modalIconClass: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    modalButtonClass: 'bg-red-600 hover:bg-red-700',
  },
  info: {
    icon: Info,
    toastClass: 'bg-slate-900/90 border-slate-700 text-white',
    modalIconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    modalButtonClass: 'bg-indigo-600 hover:bg-indigo-700',
  }
};

const BUTTON_BASE_CLASS = 'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:opacity-60 disabled:pointer-events-none';

const getFirebaseConfirmationText = () => {
  return isFirebaseConfigured
    ? 'Os dados foram sincronizados com o Firebase Firestore.'
    : 'Configure o Firebase para que estes dados também sejam sincronizados online.';
};

// --- Helpers ---

const processImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSize = 256; // Limit to 256px for storage efficiency
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// --- Components ---

const DynamicIcon = ({ name, className, size = 20 }: { name?: string, className?: string, size?: number }) => {
  if (!name) return null;

  // Check if it is an image data URL
  if (name.startsWith('data:image')) {
    return (
      <img 
        src={name} 
        alt="Icon" 
        className={`object-cover rounded-full ${className}`}
        style={{ width: size, height: size }} 
      />
    );
  }

  const IconComponent = ICON_MAP[name] ? ICON_MAP[name] : null;
  if (!IconComponent) return null;
  return <IconComponent className={className} size={size} />;
};

const IconPicker = ({ selected, onSelect }: { selected?: string, onSelect: (name: string) => void }) => {
  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-2">
      {AVAILABLE_ICONS.map(iconName => (
        <button
          key={iconName}
          onClick={() => onSelect(iconName)}
          className={`p-2 rounded-lg transition-all ${selected === iconName 
            ? 'bg-indigo-600 text-white shadow-md scale-110' 
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
          type="button"
        >
          <DynamicIcon name={iconName} size={18} />
        </button>
      ))}
    </div>
  );
};

const ImageUploadButton = ({ onImageSelected, className = '', darkMode, label = 'Imagem', iconOnly = false, onError }: { onImageSelected: (base64: string) => void, className?: string, darkMode: boolean, label?: string, iconOnly?: boolean, onError?: (message: string) => void }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        onError?.("Ops! Imagem muito grande. Tente uma menor que 2MB.");
        return;
      }
      try {
        const base64 = await processImage(file);
        onImageSelected(base64);
      } catch (err) {
        console.error("Error processing image", err);
        onError?.("Ops! Não foi possível ler a imagem. Tente novamente.");
      }
    }
  };

  return (
    <>
      <button 
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'} ${className}`}
        title="Carregar Imagem"
      >
        <Upload size={14} />
        {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
      </button>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange}
      />
    </>
  );
};

// --- Default Data Helpers ---

const generateDefaultCriteria = (eventId: string): Criterion[] => [
  { 
    id: `c1_${Date.now()}`, 
    eventId, 
    name: 'Pitch', 
    description: 'Clareza na comunicação, oratória, gestão do tempo e capacidade de vender a ideia.', 
    weight: 1 
  },
  { 
    id: `c2_${Date.now()}`, 
    eventId, 
    name: 'Protótipo', 
    description: 'Funcionalidade, acabamento, UX/UI e estágio de desenvolvimento da solução apresentada.', 
    weight: 1 
  },
  { 
    id: `c3_${Date.now()}`, 
    eventId, 
    name: 'Criatividade', 
    description: 'Originalidade da solução e abordagem única para resolver o problema.', 
    weight: 1 
  },
  { 
    id: `c4_${Date.now()}`, 
    eventId, 
    name: 'Inovação', 
    description: 'Impacto potencial, uso de novas tecnologias ou metodologias, e viabilidade de mercado.', 
    weight: 1 
  }
];

const flattenEvaluationsTree = (tree: Record<string, any> | null | undefined): Evaluation[] => {
  if (!tree) return [];
  const result: Evaluation[] = [];
  Object.values(tree).forEach((groupsByEvent: any) => {
    Object.values(groupsByEvent || {}).forEach((evaluationsByGroup: any) => {
      Object.values(evaluationsByGroup || {}).forEach((evaluation: any) => {
        if (evaluation) {
          result.push(evaluation as Evaluation);
        }
      });
    });
  });
  return result;
};

const getEventDeadline = (event: Event) => event.responseDeadline || event.date;

const isEventClosed = (event: Event) => {
  const deadline = getEventDeadline(event);
  if (!deadline) return false;
  const deadlineDate = new Date(`${deadline}T23:59:59`);
  return deadlineDate.getTime() < Date.now();
};

const formatDate = (isoDate?: string) => {
  if (!isoDate) return '-';
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR');
};

// --- App Component ---

const App = () => {
  // --- State ---
  const [role, setRole] = useState<Role>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  // Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Data
  const [events, setEvents] = useState<Event[]>(() => {
    const saved = localStorage.getItem('v5_api_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('v5_api_groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [criteria, setCriteria] = useState<Criterion[]>(() => {
    const saved = localStorage.getItem('v5_api_criteria');
    return saved ? JSON.parse(saved) : [];
  });

  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => {
    const saved = localStorage.getItem('v5_api_evaluations');
    return saved ? JSON.parse(saved) : [];
  });

  const [storedAdminPassword, setStoredAdminPassword] = useState('admin');
  const [adminPasswordLoaded, setAdminPasswordLoaded] = useState(false);

  const [toast, setToast] = useState<ToastMessage>(null);
  const [modal, setModal] = useState<ModalMessage>(null);

  // Admin View State
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const structureSyncError = useRef(false);
  const [structureSyncReady, setStructureSyncReady] = useState(!isFirebaseConfigured);
  const hasSyncedNonEmptyStructure = useRef((events.length + groups.length + criteria.length) > 0);

  // --- Effects ---
  useEffect(() => {
    if (!isFirebaseConfigured || structureSyncReady) return;
    let isMounted = true;

    const bootstrapFromFirebase = async () => {
      try {
        const [structureSnapshot, evaluationsSnapshot, remotePassword] = await Promise.all([
          fetchStructureSnapshot(),
          fetchEvaluationsSnapshot(),
          fetchAdminPassword(),
        ]);

        if (!isMounted) return;

        if (structureSnapshot) {
          const { events: remoteEvents, groups: remoteGroups, criteria: remoteCriteria } = structureSnapshot as {
            events?: Event[];
            groups?: Group[];
            criteria?: Criterion[];
          };

          if (Array.isArray(remoteEvents)) setEvents(remoteEvents);
          if (Array.isArray(remoteGroups)) setGroups(remoteGroups);
          if (Array.isArray(remoteCriteria)) setCriteria(remoteCriteria);
        }

        if (evaluationsSnapshot) {
          const flattened = flattenEvaluationsTree(evaluationsSnapshot);
          if (flattened.length) {
            setEvaluations((prev) => {
              const merged = new Map<string, Evaluation>();
              prev.forEach((evaluation) => merged.set(evaluation.id, evaluation));
              flattened.forEach((evaluation) => merged.set(evaluation.id, evaluation));
              return Array.from(merged.values());
            });
          }
        }

        if (remotePassword) {
          setStoredAdminPassword(remotePassword);
        }
        setAdminPasswordLoaded(true);
      } catch (error) {
        console.warn('Falha ao carregar dados do Firestore', error);
        showToast('error', 'Não foi possível carregar os dados do servidor. Usando dados locais.');
        setAdminPasswordLoaded(true);
      } finally {
        if (isMounted) {
          setStructureSyncReady(true);
        }
      }
    };

    bootstrapFromFirebase();
    return () => {
      isMounted = false;
    };
  }, [structureSyncReady, isFirebaseConfigured]);

  // Load admin password on mount if Firebase not configured
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAdminPasswordLoaded(true);
    }
  }, []);

  useEffect(() => { localStorage.setItem('v5_api_events', JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem('v5_api_groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('v5_api_criteria', JSON.stringify(criteria)); }, [criteria]);
  useEffect(() => { localStorage.setItem('v5_api_evaluations', JSON.stringify(evaluations)); }, [evaluations]);
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type: ToastType, message: string) => {
    setToast({ id: Date.now(), type, message });
  };

  const showModal = (type: ToastType, title: string, message: string) => {
    setModal({ id: Date.now(), type, title, message });
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !structureSyncReady) return;

    const hasData = events.length > 0 || groups.length > 0 || criteria.length > 0;
    if (!hasData && !hasSyncedNonEmptyStructure.current) {
      return;
    }

    if (hasData) {
      hasSyncedNonEmptyStructure.current = true;
    }

    syncStructureSnapshot({ events, groups, criteria })
      .then(() => {
        structureSyncError.current = false;
      })
      .catch((err) => {
        console.warn('Falha ao sincronizar estrutura no Firestore', err);
        if (!structureSyncError.current) {
          showModal('error', 'Erro ao salvar no banco de dados', 'Não foi possível salvar as alterações no servidor. Verifique sua conexão com a internet e tente novamente. Os dados continuam salvos localmente.');
          structureSyncError.current = true;
        }
      });
  }, [events, groups, criteria, structureSyncReady]);

  // --- Helpers ---
  const calculateGroupScore = (groupId: string, eventId: string) => {
    const groupEvals = evaluations.filter(e => e.groupId === groupId && e.eventId === eventId);
    if (groupEvals.length === 0) return "0.0";

    let totalScore = 0;
    groupEvals.forEach(ev => {
      let evalTotal = 0;
      let count = 0;
      Object.values(ev.scores).forEach(score => {
        evalTotal += (score as number);
        count++;
      });
      totalScore += (count > 0 ? evalTotal / count : 0);
    });

    return (totalScore / groupEvals.length).toFixed(1);
  };

  const getActiveData = () => {
    return {
      activeEvent: events.find(e => e.id === activeEventId) || null,
      activeGroups: groups.filter(g => g.eventId === activeEventId),
      activeCriteria: criteria.filter(c => c.eventId === activeEventId),
      activeEvaluations: evaluations.filter(e => e.eventId === activeEventId),
    };
  };

  const { activeGroups, activeCriteria, activeEvaluations } = getActiveData();

  const handlePersistEvaluation = (ev: Evaluation, isUpdate = false) => {
    if (isUpdate) {
      setEvaluations((prev) => prev.map((e) => e.id === ev.id ? ev : e));
    } else {
      setEvaluations((prev) => [...prev, ev]);
    }
    syncEvaluationToFirebase(ev).catch((err) => {
      console.warn('Falha ao enviar avaliação para o Firestore', err);
      showModal('error', 'Erro ao salvar avaliação', 'Não foi possível enviar sua avaliação para o servidor. Verifique sua conexão com a internet. A avaliação foi salva localmente e será sincronizada quando a conexão for restabelecida.');
    });
  };

  const handleAdminLogin = () => {
    if (adminPassword === storedAdminPassword) {
      setRole('admin');
      setShowAdminLogin(false);
      setAdminPassword('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  // --- Main Render Logic ---

  if (!role) {
    if (showAdminLogin) {
      return (
        <div className={`min-h-screen flex flex-col justify-center items-center p-6 transition-colors ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
           <div className={`p-8 rounded-2xl shadow-xl w-full max-w-sm border transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="text-center mb-6">
                  <div className={`p-3 rounded-full inline-flex mb-3 ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                      <Lock size={32} />
                  </div>
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Acesso Restrito</h2>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Digite a senha de administrador</p>
              </div>

              <input
                  type="password"
                  autoFocus
                  placeholder="Senha"
                  className={`w-full p-3 border rounded-lg mb-4 outline-none transition-all ${
                    loginError 
                      ? 'border-red-500 ring-2 ring-red-100' 
                      : darkMode 
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' 
                        : 'bg-white border-slate-300 focus:border-indigo-500'
                  }`}
                  value={adminPassword}
                  onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setLoginError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
              
              {loginError && <p className="text-red-500 text-sm mb-4 text-center font-medium">Senha incorreta.</p>}

              <button 
                  onClick={handleAdminLogin}
                  className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors mb-3"
              >
                  Entrar
              </button>
              <button 
                  onClick={() => { setShowAdminLogin(false); setAdminPassword(''); setLoginError(false); }}
                  className={`w-full py-2 font-medium hover:opacity-80 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                  Voltar
              </button>
           </div>
        </div>
      );
    }

    return (
      <div className={`min-h-screen flex flex-col justify-center items-center p-6 transition-colors ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
         
         <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg ${darkMode ? 'bg-slate-800 text-yellow-200 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span>{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>
         </div>

         <div className="mb-10 text-center">
            <div className="bg-indigo-600 text-white p-4 rounded-2xl inline-block mb-4 shadow-lg shadow-indigo-500/20">
              <Award size={48} />
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Avaliação de Projeto Integrador SENAI</h1>
            <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecione seu perfil para continuar</p>
         </div>

         <div className="grid gap-4 w-full max-w-md">
            <button 
              onClick={() => setRole('evaluator')}
              className={`flex items-center gap-4 p-6 rounded-xl shadow-md border-2 border-transparent transition-all group ${
                darkMode ? 'bg-slate-900 hover:border-indigo-500' : 'bg-white hover:border-indigo-500'
              }`}
            >
              <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                 <PenTool size={32} />
              </div>
              <div className="text-left">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Sou Avaliador</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quero avaliar os grupos</p>
              </div>
            </button>

            <button 
              onClick={() => setShowAdminLogin(true)}
              className={`flex items-center gap-4 p-6 rounded-xl shadow-md border-2 border-transparent transition-all group ${
                darkMode ? 'bg-slate-900 hover:border-slate-500' : 'bg-white hover:border-slate-500'
              }`}
            >
              <div className={`p-3 rounded-full transition-colors ${darkMode ? 'bg-slate-800 text-slate-300 group-hover:bg-slate-700 group-hover:text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white'}`}>
                 <Settings size={32} />
              </div>
              <div className="text-left">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Sou Administrador</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gerenciar evento e resultados</p>
              </div>
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 font-sans transition-colors ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`${role === 'admin' ? (darkMode ? 'bg-slate-900' : 'bg-slate-800') : 'bg-indigo-600'} text-white p-4 shadow-md sticky top-0 z-10 transition-colors`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {role === 'admin' ? <Shield className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            <div>
              <h1 className="text-lg font-bold leading-tight">
                {role === 'admin' ? 'Admin. Evento' : 'Área do Avaliador'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button 
              onClick={() => { setRole(null); setActiveEventId(null); }} 
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded flex items-center gap-1 transition-colors backdrop-blur-sm"
            >
              <LogOut size={14}/> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4">
        
        {/* EVALUATOR VIEW */}
        {role === 'evaluator' && (
           <EvaluationView 
             events={events}
             activeEventId={activeEventId}
             setActiveEventId={setActiveEventId}
             groups={activeGroups} 
             criteria={activeCriteria} 
               onSave={handlePersistEvaluation}
             evaluations={activeEvaluations}
             darkMode={darkMode}
              showToast={showToast}
              showModal={showModal}
           />
        )}

        {/* ADMIN VIEW */}
        {role === 'admin' && (
          <>
            {events.length === 0 && adminView !== 'config' ? (
              <div className="text-center py-20 px-6">
                <FolderPlus className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-slate-700' : 'text-slate-300'}`} />
                <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Bem-vindo, Admin!</h2>
                <p className={`mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Comece criando um Evento para que os avaliadores possam dar notas.</p>
                <button 
                  onClick={() => setAdminView('config')}
                  className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                >
                  Criar Evento
                </button>
              </div>
            ) : (
              <>
                {adminView === 'dashboard' && (
                  <DashboardView 
                    events={events}
                    activeEventId={activeEventId}
                    setActiveEventId={setActiveEventId}
                    groups={activeGroups} 
                    evaluations={activeEvaluations} 
                    criteria={activeCriteria}
                    calculateGroupScore={(gid: string) => calculateGroupScore(gid, activeEventId!)}
                    darkMode={darkMode}
                  />
                )}
                
                {adminView === 'config' && (
                  <ConfigView 
                    events={events}
                    setEvents={setEvents}
                    groups={groups} 
                    setGroups={setGroups} 
                    criteria={criteria} 
                    setCriteria={setCriteria}
                    activeEventId={activeEventId}
                    setActiveEventId={setActiveEventId}
                    onReset={() => {
                      if(confirm('Tem certeza? Isso apagará TODOS os eventos, grupos e avaliações.')) {
                        setEvaluations([]);
                        setGroups([]);
                        setCriteria([]);
                        setEvents([]);
                        setActiveEventId(null);
                      }
                    }}
                    darkMode={darkMode}
                    adminPassword={storedAdminPassword}
                    setAdminPassword={setStoredAdminPassword}
                    showToast={showToast}
                    showModal={showModal}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Admin Navigation */}
      {role === 'admin' && (
        <nav className={`fixed bottom-0 left-0 right-0 border-t shadow-lg z-50 px-6 py-2 pb-safe transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="max-w-3xl mx-auto flex justify-around items-center">
            <NavButton 
              active={adminView === 'dashboard'} 
              onClick={() => { setAdminView('dashboard'); setActiveEventId(null); }} 
              icon={<BarChart3 />} 
              label="Resultados" 
              activeColor={darkMode ? 'text-white' : 'text-slate-800'}
              darkMode={darkMode}
            />
            <NavButton 
              active={adminView === 'config'} 
              onClick={() => { setAdminView('config'); setActiveEventId(null); }} 
              icon={<Settings />} 
              label="Ajustes" 
              activeColor={darkMode ? 'text-white' : 'text-slate-800'}
              darkMode={darkMode}
            />
          </div>
        </nav>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4">
          <div className={`px-5 py-3 rounded-2xl shadow-xl border text-sm font-medium flex items-center gap-2 ${FEEDBACK_VARIANTS[toast.type].toastClass}`}>
            {React.createElement(FEEDBACK_VARIANTS[toast.type].icon, { size: 16 })}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}></div>
          <div className={`relative w-full max-w-md rounded-3xl shadow-2xl border px-6 py-7 text-center space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${FEEDBACK_VARIANTS[modal.type].modalIconClass}`}>
              {React.createElement(FEEDBACK_VARIANTS[modal.type].icon, { size: 32 })}
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">{modal.title}</h3>
              <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>{modal.message}</p>
            </div>
            <button 
              onClick={() => setModal(null)}
              className={`${BUTTON_BASE_CLASS} w-full py-3 text-white ${FEEDBACK_VARIANTS[modal.type].modalButtonClass}`}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, activeColor, darkMode }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors w-24 ${active ? activeColor : (darkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600')}`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

// --- Dashboard View ---

const DashboardView = ({ events, activeEventId, setActiveEventId, groups, evaluations, criteria, calculateGroupScore, darkMode }: any) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Sort events by date descending
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const { ongoingEvents, pastEvents } = useMemo(() => {
    const ongoing: Event[] = [];
    const past: Event[] = [];
    sortedEvents.forEach((evt: Event) => {
      if (isEventClosed(evt)) {
        past.push(evt);
      } else {
        ongoing.push(evt);
      }
    });
    return { ongoingEvents: ongoing, pastEvents: past };
  }, [sortedEvents]);

  // Sort groups by score descending
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a: Group, b: Group) => {
      return parseFloat(calculateGroupScore(b.id)) - parseFloat(calculateGroupScore(a.id));
    });
  }, [groups, evaluations, calculateGroupScore]);

  const generateFeedback = async (group: Group) => {
    const groupEvals = evaluations.filter((e: Evaluation) => e.groupId === group.id);
    if (groupEvals.length === 0) return;

    setLoadingAi(true);
    setAiFeedback(null);

    try {
      const breakdown = criteria.map((c: Criterion) => {
        const scores = groupEvals.map((e: Evaluation) => e.scores[c.id] || 0);
        const avg = scores.reduce((acc: number, val: number) => acc + val, 0) / scores.length;
        return `${c.name} (${c.description}): ${avg.toFixed(1)}/10`;
      }).join('\n');

      const prompt = `
        Atue como um professor avaliador experiente de Projetos Integradores.
        O projeto avaliado é: "${group.name}".
        
        Aqui estão as médias das notas por critério:
        ${breakdown}
        
        Gere um feedback construtivo curto (máximo 3 frases) em português. 
        Destaque o ponto mais forte e sugira uma melhoria prática para o ponto mais fraco.
        Seja direto e encorajador.
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAiFeedback(response.text || "Sem resposta do modelo.");
    } catch (error) {
      console.error(error);
      setAiFeedback("Não foi possível gerar o feedback no momento.");
    } finally {
      setLoadingAi(false);
    }
  };

  if (events.length === 0) return null;

  // 1. EVENT SELECTION (Cards for Dashboard)
  if (!activeEventId) {
    return (
      <div className="animate-in fade-in space-y-6">
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
           <Info className="text-slate-500 shrink-0 mt-0.5" size={20} />
           <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Escolha um evento em andamento para acompanhar resultados ao vivo. Eventos finalizados permanecem disponíveis abaixo para consulta.</p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wide px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Eventos acontecendo</h3>
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{ongoingEvents.length}</span>
          </div>
          {ongoingEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {ongoingEvents.map((e: Event) => (
                <button
                  key={e.id}
                  onClick={() => setActiveEventId(e.id)}
                  className={`p-6 rounded-xl shadow-sm border transition-all text-left flex items-start gap-4 group ${
                    darkMode 
                      ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' 
                      : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                  }`}
                >
                  <div className={`p-3 rounded-xl transition-colors w-16 h-16 flex items-center justify-center shrink-0 ${
                    darkMode 
                      ? 'bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white' 
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white'
                  }`}>
                    {e.icon ? <DynamicIcon name={e.icon} size={28} /> : <BarChart3 size={28} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{e.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {formatDate(getEventDeadline(e))}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Prazo para respostas</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={`p-6 rounded-xl border text-center text-sm ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-500'}`}>
              Nenhum evento ativo neste momento.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wide px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Eventos finalizados</h3>
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{pastEvents.length}</span>
          </div>
          {pastEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {pastEvents.map((e: Event) => (
                <button
                  key={e.id}
                  onClick={() => setActiveEventId(e.id)}
                  className={`p-6 rounded-xl border text-left flex items-start gap-4 ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-red-400/40' : 'bg-white border-slate-200 hover:border-red-200'} transition-all`}
                >
                  <div className={`p-3 rounded-xl w-16 h-16 flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-800 text-red-300' : 'bg-red-50 text-red-600'}`}>
                    {e.icon ? <DynamicIcon name={e.icon} size={28} /> : <Calendar size={28} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{e.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${darkMode ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>Encerrado</span>
                    </div>
                    <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Prazo encerrado em <span className="font-semibold">{formatDate(getEventDeadline(e))}</span></p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={`p-6 rounded-xl border text-center text-sm ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-500'}`}>
              Ainda não há eventos finalizados.
            </div>
          )}
        </section>
      </div>
    );
  }

  // 2. RESULTS DISPLAY
  const currentEvent = events.find((e: Event) => e.id === activeEventId);
  const currentEventClosed = currentEvent ? isEventClosed(currentEvent) : false;
  const currentEventDeadline = currentEvent ? getEventDeadline(currentEvent) : null;
  
  return (
    <div>
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 p-4 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
         <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ranking do Evento</label>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentEvent?.name}</h2>
            {currentEventDeadline && (
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Prazo para respostas: <span className="font-semibold">{formatDate(currentEventDeadline)}</span>
              </p>
            )}
         </div>
         <div className="flex items-center gap-2">
           <span className={`text-xs font-semibold px-3 py-1 rounded-full ${currentEventClosed ? (darkMode ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600') : (darkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600')}`}>
             {currentEventClosed ? 'Evento encerrado' : 'Evento em andamento'}
           </span>
           <button 
             onClick={() => setActiveEventId(null)}
             className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${
               darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
             }`}
           >
             <ArrowLeft size={14} /> Outros Eventos
           </button>
         </div>
      </div>

      {groups.length === 0 ? (
        <div className={`text-center py-10 rounded-xl border border-dashed ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
          <p className="text-slate-500">Nenhum grupo cadastrado neste evento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Classificação dos Grupos</h2>
          
          {sortedGroups.map((group: Group, index: number) => {
            const score = calculateGroupScore(group.id);
            const isExpanded = expandedGroup === group.id;
            const groupEvals = evaluations.filter((e: Evaluation) => e.groupId === group.id);
            const groupComments = groupEvals
              .filter((e: Evaluation) => e.groupComment && e.groupComment.trim().length > 0)
              .map((e: Evaluation) => ({
                id: e.id,
                text: e.groupComment!.trim(),
                evaluator: e.evaluatorName || 'Avaliador',
                timestamp: e.timestamp
              }));
            
            return (
              <div key={group.id} className={`rounded-xl shadow-sm border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div 
                  className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                  onClick={() => {
                    setExpandedGroup(isExpanded ? null : group.id);
                    setAiFeedback(null);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                      ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                        index === 1 ? 'bg-slate-200 text-slate-700' : 
                        index === 2 ? 'bg-orange-100 text-orange-800' : 
                        (darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}
                    `}>
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className={`font-semibold leading-tight flex items-center gap-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {group.name}
                        {group.icon && group.icon.startsWith('data:') && (
                           <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-300">
                              <DynamicIcon name={group.icon} size={20} />
                           </div>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{groupEvals.length} avaliações</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{score}</span>
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className={`px-4 pb-4 pt-0 border-t ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    
                    {/* Project Scores */}
                    <div className="mt-4 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Notas do Projeto</h4>
                      {criteria.map((c: Criterion) => {
                        const scores = groupEvals.map((e: Evaluation) => e.scores[c.id] || 0);
                        const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
                        return (
                          <div key={c.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm gap-1 sm:gap-0">
                            <span className={`${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{c.name}</span>
                            <div className="flex items-center gap-2 w-full sm:w-1/2">
                              <div className={`h-2 rounded-full flex-1 overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                <div className="h-full bg-slate-600 rounded-full" style={{ width: `${avg * 10}%` }}></div>
                              </div>
                              <span className={`font-mono font-medium w-8 text-right ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{avg.toFixed(1)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Individual Scores */}
                    {group.members.length > 0 && (
                      <div className="mt-6 space-y-3">
                         <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Notas Individuais (Média)</h4>
                         {group.members.map((member: Member) => {
                           const memberScores = groupEvals
                             .map((e: Evaluation) => e.individualScores?.[member.id])
                             .filter((s) => s !== undefined) as number[];
                           
                           const avg = memberScores.length > 0 
                             ? memberScores.reduce((a,b) => a+b, 0) / memberScores.length 
                             : 0;

                           return (
                             <div key={member.id} className={`flex justify-between items-center text-sm p-2 rounded-lg ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                               <div className={`flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                 {member.icon ? <DynamicIcon name={member.icon} size={14} className="text-slate-400" /> : <User size={14} className="text-slate-400"/>}
                                 <span>{member.name}</span>
                               </div>
                               <span className={`font-bold ${avg > 0 ? (darkMode ? 'text-slate-200' : 'text-slate-700') : 'text-slate-400'}`}>
                                 {avg > 0 ? avg.toFixed(1) : '-'}
                                </span>
                             </div>
                           );
                         })}
                      </div>
                    )}

                    {/* Evaluator Comments */}
                    <div className="mt-6 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Comentários dos Avaliadores</h4>
                      {groupComments.length > 0 ? (
                        groupComments.map((comment) => {
                          const commentDate = new Date(comment.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                          return (
                            <div key={comment.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                                <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{comment.evaluator}</span>
                                <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>{commentDate}</span>
                              </div>
                              <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{comment.text}</p>
                            </div>
                          );
                        })
                      ) : (
                        <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Nenhum comentário registrado para este grupo.</p>
                      )}
                    </div>

                    {/* AI Feedback */}
                    <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                      {!aiFeedback ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); generateFeedback(group); }}
                          disabled={loadingAi}
                          className={`w-full py-3 border rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 ${
                            darkMode 
                             ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800' 
                             : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {loadingAi ? (
                             <>Gerando Análise...</>
                          ) : (
                            <><Sparkles size={16} /> Gerar Feedback com IA</>
                          )}
                        </button>
                      ) : (
                        <div className={`p-4 rounded-lg border relative ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                          <div className="flex items-start gap-3">
                            <Sparkles size={18} className="text-slate-600 mt-0.5 shrink-0" />
                            <div>
                              <h5 className={`text-xs font-bold uppercase mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>Feedback Sugerido</h5>
                              <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-700'}`}>{aiFeedback}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Evaluation View ---

const EvaluationView = ({ events, activeEventId, setActiveEventId, groups, criteria, onSave, evaluations, darkMode, showToast, showModal }: any) => {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [indivScores, setIndivScores] = useState<Record<string, number>>({});
  const [groupComment, setGroupComment] = useState('');
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);

  const selectedGroup = groups.find((g: Group) => g.id === selectedGroupId);
  const activeEvent = events.find((e: Event) => e.id === activeEventId);

  // Find existing evaluation for current evaluator+group combination
  const existingEvaluation = useMemo(() => {
    if (!evaluatorName || !selectedGroupId || !activeEventId) return null;
    return evaluations.find((ev: Evaluation) => 
      ev.eventId === activeEventId && 
      ev.groupId === selectedGroupId && 
      ev.evaluatorName.toLowerCase().trim() === evaluatorName.toLowerCase().trim()
    );
  }, [evaluations, evaluatorName, selectedGroupId, activeEventId]);

  // Load existing evaluation data when found
  useEffect(() => {
    if (existingEvaluation && !editingEvaluationId) {
      setScores(existingEvaluation.scores || {});
      setIndivScores(existingEvaluation.individualScores || {});
      setGroupComment(existingEvaluation.groupComment || '');
      setEditingEvaluationId(existingEvaluation.id);
    }
  }, [existingEvaluation]);

  useEffect(() => {
    const savedName = localStorage.getItem('last_evaluator_name');
    if (savedName) setEvaluatorName(savedName);
  }, []);

  const handleEventSelection = (event: Event) => {
    if (isEventClosed(event)) {
      showToast('info', 'Prazo encerrado! Este evento não aceita mais avaliações.');
      return;
    }
    setActiveEventId(event.id);
    setSelectedGroupId('');
    setScores({});
    setIndivScores({});
    setGroupComment('');
    setEditingEvaluationId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    if (!evaluatorName.trim()) {
      showToast('error', 'Ops! Informe seu nome para continuar.');
      return;
    }
    if (!selectedGroupId) {
      showToast('error', 'Ops! Escolha um grupo para enviar a avaliação.');
      return;
    }
    if (!activeEvent || isEventClosed(activeEvent)) {
      showToast('error', 'Prazo encerrado! Este evento não aceita mais novas avaliações.');
      setActiveEventId(null);
      setSelectedGroupId('');
      setScores({});
      setIndivScores({});
      setGroupComment('');
      return;
    }

    const normalizedComment = groupComment.trim();
    const isUpdate = !!editingEvaluationId;

    const evaluation: Evaluation = {
      id: isUpdate ? editingEvaluationId : Date.now().toString(),
      eventId: activeEventId,
      groupId: selectedGroupId,
      evaluatorName,
      scores,
      individualScores: indivScores,
      groupComment: normalizedComment || undefined,
      timestamp: Date.now()
    };
    
    localStorage.setItem('last_evaluator_name', evaluatorName);
    onSave(evaluation, isUpdate);
    
    setSelectedGroupId('');
    setScores({});
    setIndivScores({});
    setGroupComment('');
    setEditingEvaluationId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('success', isUpdate ? 'Avaliação atualizada!' : 'Sucesso! Avaliação salva.');
    showModal('success', isUpdate ? 'Avaliação atualizada!' : 'Avaliação registrada!', `As notas foram salvas e estarão disponíveis para o administrador revisar. ${getFirebaseConfirmationText()}`);
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const { ongoingEvents, pastEvents } = useMemo(() => {
    const ongoing: Event[] = [];
    const past: Event[] = [];
    sortedEvents.forEach((evt: Event) => {
      if (isEventClosed(evt)) {
        past.push(evt);
      } else {
        ongoing.push(evt);
      }
    });
    return { ongoingEvents: ongoing, pastEvents: past };
  }, [sortedEvents]);

  const accentCardBg = darkMode ? 'bg-violet-500/15 border-violet-500/30' : 'bg-white border-slate-200';
  const accentIconBg = darkMode ? 'bg-violet-500/20 text-violet-200' : 'bg-indigo-100 text-indigo-600';
  const accentIconHover = darkMode ? 'group-hover:bg-violet-500 group-hover:text-white' : 'group-hover:bg-indigo-600 group-hover:text-white';
  const accentChipBg = darkMode ? 'bg-violet-500/20 text-violet-200 border border-violet-400/30' : 'bg-white border border-indigo-100 text-indigo-600';
  const accentButton = darkMode ? 'bg-violet-500 hover:bg-violet-600' : 'bg-indigo-600 hover:bg-indigo-700';
  const accentText = darkMode ? 'text-violet-300' : 'text-indigo-500';
  const accentHoverBorder = darkMode ? 'hover:border-violet-500' : 'hover:border-indigo-500';
  const activeEventClosed = activeEvent ? isEventClosed(activeEvent) : false;
  const activeEventDeadline = activeEvent ? getEventDeadline(activeEvent) : null;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in">
         <div className={`p-6 rounded-full mb-6 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <CalendarX className={`w-16 h-16 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
         </div>
         <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Nenhum Evento Encontrado</h3>
         <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
           Não há eventos disponíveis para avaliação no momento. 
           Peça ao administrador para cadastrar um novo evento.
         </p>
      </div>
    );
  }

  if (!activeEventId) {
    return (
      <div className="animate-in fade-in space-y-6">
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <Info className="text-slate-500 shrink-0 mt-0.5" size={20} />
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Escolha um evento em andamento para registrar notas. Eventos com prazo encerrado aparecem em “Eventos passados” e ficam bloqueados para novas avaliações.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wide px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Eventos em andamento</h3>
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{ongoingEvents.length} disponíveis</span>
          </div>
          {ongoingEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {ongoingEvents.map((event: Event) => {
                const deadlineLabel = formatDate(getEventDeadline(event));
                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventSelection(event)}
                    className={`p-6 rounded-xl shadow-sm border transition-all text-left flex items-start gap-4 group ${
                      darkMode 
                        ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' 
                        : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md'
                    }`}
                  >
                    <div className={`p-3 rounded-xl transition-colors w-16 h-16 flex items-center justify-center shrink-0 ${
                      darkMode 
                        ? 'bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white' 
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white'
                    }`}>
                      {event.icon ? <DynamicIcon name={event.icon} size={28} /> : <BarChart3 size={28} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{event.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          {formatDate(event.date)}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Prazo para respostas: <span className="font-semibold">{deadlineLabel}</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`p-6 rounded-xl border text-center text-sm ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-500'}`}>
              Nenhum evento aberto no momento.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wide px-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Eventos passados</h3>
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{pastEvents.length}</span>
          </div>
          {pastEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {pastEvents.map((event: Event) => {
                const deadlineLabel = formatDate(getEventDeadline(event));
                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventSelection(event)}
                    className={`p-6 rounded-xl border text-left flex items-start gap-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} cursor-not-allowed opacity-70`}
                  >
                    <div className={`p-3 rounded-xl w-16 h-16 flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                      {event.icon ? <DynamicIcon name={event.icon} size={28} /> : <Calendar size={28} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{event.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${darkMode ? 'bg-slate-800 text-red-300' : 'bg-red-50 text-red-600'}`}>Encerrado</span>
                      </div>
                      <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Prazo encerrado em <span className="font-semibold">{deadlineLabel}</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`p-6 rounded-xl border text-center text-sm ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-500'}`}>
              Ainda não há eventos encerrados.
            </div>
          )}
        </section>
      </div>
    );
  }

  // 2. MAIN EVALUATION SCREEN
  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className={`p-5 rounded-xl shadow-sm border space-y-5 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`flex justify-between items-center border-b pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
           <div>
             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Evento Selecionado</label>
             <h2 className={`text-lg font-bold ${accentText}`}>{activeEvent?.name}</h2>
             {activeEventDeadline && (
               <p className={`text-xs mt-1 flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                 Prazo para respostas: <span className="font-semibold">{formatDate(activeEventDeadline)}</span>
                 {activeEventClosed && (
                   <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                     <AlertTriangle size={12} /> Encerrado
                   </span>
                 )}
               </p>
             )}
           </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Seu Nome (Avaliador)</label>
          <input 
            type="text" 
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
              darkMode 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-white border-slate-300'
            }`}
            placeholder="Ex: Prof. Silva"
            value={evaluatorName}
            onChange={(e) => setEvaluatorName(e.target.value)}
          />
        </div>
      </div>

      {activeEventClosed ? (
        <div className={`p-6 rounded-xl border text-center ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Prazo encerrado</h3>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} text-sm mb-4`}>
            Este evento não aceita mais avaliações. Volte para a lista e selecione um evento em andamento.
          </p>
          <button 
            onClick={() => setActiveEventId(null)}
            className={`${BUTTON_BASE_CLASS} ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-800 hover:bg-slate-900 text-white'} px-4 py-3`}
          >
            <ArrowLeft size={16} /> Ver outros eventos
          </button>
        </div>
      ) : (
      <>
      {/* 2. Group Selection */}
      {!selectedGroupId && activeEventId && (
        <div className="space-y-3">
          <button 
             onClick={() => setActiveEventId(null)}
             className={`flex items-center gap-2 font-medium transition-colors mb-2 ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
           >
             <ArrowLeft size={20} /> Voltar para Eventos
          </button>

          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">Selecione um Grupo</h3>
          
          {groups.length === 0 ? (
             <div className={`text-center py-12 rounded-xl border border-dashed ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <p className="text-slate-500">Nenhum grupo encontrado.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groups.map((g: Group) => {
                const groupEvals = evaluations.filter((e: Evaluation) => e.groupId === g.id && e.evaluatorName === evaluatorName);
                const isEvaluated = groupEvals.length > 0;
                
                return (
                  <button 
                    key={g.id}
                    onClick={() => {
                      if (!evaluatorName) {
                        showToast('info', 'Atenção! Informe seu nome antes de abrir um grupo.');
                            return;
                        }
                        setSelectedGroupId(g.id);
                        setGroupComment('');
                    }}
                    className={`text-left p-5 rounded-xl border transition-all shadow-sm hover:shadow-md active:scale-[0.98] ${
                      isEvaluated 
                        ? (darkMode ? 'bg-violet-500/15 border-violet-500/30' : 'bg-indigo-50 border-indigo-200') 
                        : (darkMode ? 'bg-slate-900 border-slate-800 ' + accentHoverBorder : 'bg-white border-slate-200 hover:border-indigo-300')
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className={`p-2 rounded-lg ${darkMode ? 'bg-violet-500/20 text-violet-200' : 'bg-indigo-100 text-indigo-700'}`}>
                        {g.icon ? <DynamicIcon name={g.icon} size={20} /> : <Users size={20} />}
                      </div>
                      {isEvaluated && (
                         <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${accentChipBg}`}>
                           <CheckCircle2 size={12} /> Avaliado
                         </span>
                      )}
                    </div>
                    <h4 className={`font-bold text-lg mb-1 leading-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{g.name}</h4>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{g.members.length} integrantes</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Evaluation Form */}
      {selectedGroupId && selectedGroup && (
        <div className="animate-in slide-in-from-right-4 space-y-8">
          
          <button 
            onClick={() => {
              setSelectedGroupId('');
              setGroupComment('');
              setScores({});
              setIndivScores({});
              setEditingEvaluationId(null);
            }}
            className={`flex items-center gap-2 font-medium transition-colors ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <ArrowLeft size={20} /> Voltar para Grupos
          </button>

          {editingEvaluationId && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${darkMode ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
              <PenTool size={16} />
              <span className="text-sm font-medium">Você está editando uma avaliação existente</span>
            </div>
          )}

          <div className="text-center mb-6">
             <div className="inline-block p-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
               {selectedGroup.icon ? <DynamicIcon name={selectedGroup.icon} size={64} /> : <Users size={64} className="text-indigo-600" />}
             </div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{selectedGroup.name}</h2>
            <p className={`${accentText}`}>{editingEvaluationId ? 'Editar Avaliação' : 'Avaliação do Grupo'}</p>
          </div>

          {/* Criteria */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1 mb-3">Critérios de Avaliação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {criteria.map((criterion: Criterion) => (
                <div key={criterion.id} className={`p-5 rounded-xl shadow-sm border flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-bold text-lg leading-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>{criterion.name}</h4>
                      <button 
                        onClick={() => setActiveInfo(activeInfo === criterion.id ? null : criterion.id)}
                        className={`p-1 rounded-full shrink-0 ${activeInfo === criterion.id ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
                      >
                        <Info size={18} />
                      </button>
                    </div>
                    
                    {activeInfo === criterion.id && (
                        <p className={`text-xs p-2 rounded mb-3 ${darkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                           {criterion.description}
                        </p>
                    )}
                    {!activeInfo && (
                       <p className="text-xs text-slate-400 line-clamp-2">{criterion.description}</p>
                    )}
                  </div>

                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold text-slate-400 uppercase">Nota</span>
                      <span className={`text-xl font-bold ${scores[criterion.id] !== undefined ? (darkMode ? 'text-violet-300' : 'text-indigo-600') : (darkMode ? 'text-slate-700' : 'text-slate-300')}`}>
                            {scores[criterion.id] ?? '-'}
                         </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="0.5"
                      className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${darkMode ? 'accent-violet-400 bg-slate-800' : 'accent-indigo-600 bg-slate-100'}`}
                      value={scores[criterion.id] ?? 0}
                      onChange={(e) => setScores({...scores, [criterion.id]: parseFloat(e.target.value)})}
                    />
                     <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                     </div>
                  </div>
                </div>
              ))}
                </div>
          </div>

          {/* Group Comments */}
          <div className={`p-5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Comentários do Avaliador</h3>
              <span className={`text-xs font-semibold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Opcional</span>
            </div>
            <textarea
              rows={4}
              value={groupComment}
              onChange={(e) => setGroupComment(e.target.value)}
              placeholder="Compartilhe percepções qualitativas sobre este grupo."
              className={`w-full p-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${darkMode ? 'bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
            />
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Esses comentários aparecerão na aba de resultados junto com as notas.</p>
          </div>

          <button 
            onClick={handleSubmit}
            className={`${BUTTON_BASE_CLASS} w-full ${editingEvaluationId ? 'bg-amber-600 hover:bg-amber-700' : accentButton} text-white py-4 text-lg shadow-lg active:scale-[0.98]`}
          >
            {editingEvaluationId ? (
              <><PenTool /> Atualizar Avaliação</>
            ) : (
              <><Save /> Confirmar Avaliação</>
            )}
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
};

// --- Config View ---

const ConfigView = ({ events, setEvents, groups, setGroups, criteria, setCriteria, activeEventId, setActiveEventId, onReset, darkMode, adminPassword, setAdminPassword, showToast, showModal }: any) => {
  const [viewState, setViewState] = useState<'list' | 'edit'>('list');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  
  // New Event Inputs
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventDeadline, setNewEventDeadline] = useState(new Date().toISOString().split('T')[0]);
  const [newEventIcon, setNewEventIcon] = useState('Calendar');
  
  // Inputs
  const [newItemName, setNewItemName] = useState(''); 
  const [newItemDesc, setNewItemDesc] = useState(''); 
  const [newItemIcon, setNewItemIcon] = useState(''); 
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberIcon, setNewMemberIcon] = useState('User');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setNewEventDeadline((prev) => (prev < newEventDate ? newEventDate : prev));
  }, [newEventDate]);

  const currentEvent = events.find((e: Event) => e.id === activeEventId);
  const currentGroups = groups.filter((g: Group) => g.eventId === activeEventId);
  const currentCriteria = criteria.filter((c: Criterion) => c.eventId === activeEventId);

  // --- Handlers ---

  const updateEventIcon = (iconValue: string) => {
    if (!currentEvent) return;
    setEvents(events.map((evt: Event) => evt.id === currentEvent.id ? { ...evt, icon: iconValue } : evt));
  };

  const updateEventDate = (dateValue: string) => {
    if (!currentEvent) return;
    setEvents(events.map((evt: Event) => {
      if (evt.id !== currentEvent.id) return evt;
      const normalizedDeadline = evt.responseDeadline && evt.responseDeadline >= dateValue ? evt.responseDeadline : dateValue;
      return { ...evt, date: dateValue, responseDeadline: normalizedDeadline };
    }));
  };

  const updateEventDeadline = (deadlineValue: string) => {
    if (!currentEvent) return;
    setEvents(events.map((evt: Event) => evt.id === currentEvent.id ? { ...evt, responseDeadline: deadlineValue || evt.date } : evt));
  };
  
  const handleAddEvent = () => {
    if (!newEventName.trim()) {
      showModal('error', 'Campos obrigatórios', 'Informe o nome do evento antes de salvar.');
      return;
    }
    const newEvent: Event = { 
      id: Date.now().toString(), 
      name: newEventName,
      date: newEventDate,
      responseDeadline: newEventDeadline || newEventDate,
      icon: newEventIcon
    };
    const newEvtCriteria = generateDefaultCriteria(newEvent.id);
    
    setEvents([...events, newEvent]);
    setCriteria([...criteria, ...newEvtCriteria]);
    setNewEventName('');
    setNewEventIcon('Calendar');
    setNewEventDeadline(newEventDate);
    setActiveEventId(newEvent.id);
    setViewState('edit');
    showModal('success', 'Evento criado!', `O evento "${newEvent.name}" já aparece para avaliação. ${getFirebaseConfirmationText()}`);
  };

  const handleDeleteEvent = (eId: string) => {
    if(!confirm("Tem certeza? Isso apaga todos os grupos e critérios deste evento.")) return;
    setEvents(events.filter((e: Event) => e.id !== eId));
    setGroups(groups.filter((g: Group) => g.eventId !== eId));
    setCriteria(criteria.filter((c: Criterion) => c.eventId !== eId));
    if (activeEventId === eId) {
      setActiveEventId(null);
      setViewState('list');
    }
  };

  const handleAddGroup = () => {
    if (!activeEventId) {
      showModal('error', 'Selecione um evento', 'Escolha um evento para adicionar grupos.');
      return;
    }
    if (!newItemName.trim()) {
      showModal('error', 'Campos obrigatórios', 'Informe o nome do grupo antes de salvar.');
      return;
    }
    const newGroup: Group = { 
      id: `g_${Date.now()}`, 
      eventId: activeEventId, 
      name: newItemName, 
      icon: newItemIcon || 'Users',
      members: [] 
    };
    setGroups([...groups, newGroup]);
    setNewItemName('');
    setNewItemIcon('');
    setEditingGroupId(newGroup.id);
    showModal('success', 'Grupo adicionado!', `O grupo "${newGroup.name}" já pode receber avaliações. ${getFirebaseConfirmationText()}`);
  };

  const updateGroupIcon = (groupId: string, iconValue: string) => {
    setGroups(groups.map((grp: Group) => grp.id === groupId ? { ...grp, icon: iconValue } : grp));
  };

  const handleAddMember = (groupId: string) => {
     if (!newMemberName.trim()) return;
     const updatedGroups = groups.map((g: Group) => {
       if (g.id === groupId) {
         return {
           ...g,
           members: [...g.members, { id: `m_${Date.now()}`, name: newMemberName, icon: newMemberIcon || 'User' }]
         }
       }
       return g;
     });
     setGroups(updatedGroups);
     setNewMemberName('');
     setNewMemberIcon('User');
  };

  const handleRemoveMember = (groupId: string, memberId: string) => {
    const updatedGroups = groups.map((g: Group) => {
      if (g.id === groupId) {
        return {
          ...g,
          members: g.members.filter((m) => m.id !== memberId)
        }
      }
      return g;
    });
    setGroups(updatedGroups);
  };

  const updateMemberIcon = (groupId: string, memberId: string, iconValue: string) => {
    setGroups(groups.map((grp: Group) => {
      if (grp.id !== groupId) return grp;
      return {
        ...grp,
        members: grp.members.map((member) => member.id === memberId ? { ...member, icon: iconValue } : member)
      };
    }));
  };

  const handleAddCriteria = () => {
    if (!newItemName.trim() || !activeEventId) return;
    setCriteria([...criteria, { 
      id: `c_${Date.now()}`, 
      eventId: activeEventId, 
      name: newItemName, 
      description: newItemDesc || 'Sem descrição', 
      weight: 1 
    }]);
    setNewItemName('');
    setNewItemDesc('');
  };

  const handlePasswordChange = () => {
    if (currentPasswordInput !== adminPassword) {
      setPasswordFeedback({ type: 'error', message: 'Senha atual incorreta.' });
      showModal('error', 'Senha incorreta', 'A senha atual não confere. Tente novamente.');
      return;
    }
    if (newPasswordInput.length < 4) {
      setPasswordFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 4 caracteres.' });
      showModal('error', 'Senha muito curta', 'Defina uma nova senha com pelo menos 4 caracteres.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordFeedback({ type: 'error', message: 'As senhas novas não conferem.' });
      showModal('error', 'Confirmação inválida', 'A confirmação precisa ser igual à nova senha.');
      return;
    }
    setAdminPassword(newPasswordInput);
    saveAdminPassword(newPasswordInput).catch((err) => {
      console.warn('Falha ao salvar senha no Firestore', err);
    });
    setPasswordFeedback({ type: 'success', message: 'Senha atualizada com sucesso.' });
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    showModal('success', 'Senha atualizada!', 'Seu acesso de administrador foi atualizado e sincronizado com o servidor.');
  };

  // --- Render ---

  if (viewState === 'list' || !currentEvent) {
    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            <Layout size={20} className="text-slate-600"/> Meus Eventos
          </h3>
          
          <div className="flex flex-col gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Novo Evento (ex: PI 2025.1)"
              className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:border-slate-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
            />
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data do Evento</label>
                <input 
                  type="date"
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:border-slate-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-600'}`}
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prazo para Respostas</label>
                <input 
                  type="date"
                  className={`w-full p-3 border rounded-lg text-sm focus:outline-none focus:border-slate-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-600'}`}
                  min={newEventDate}
                  value={newEventDeadline}
                  onChange={(e) => setNewEventDeadline(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button 
                onClick={handleAddEvent} 
                className={`${BUTTON_BASE_CLASS} flex-1 text-sm text-white py-3 px-4 shadow-sm active:scale-95 ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-slate-900'}`}
              >
                <Check size={16} /> Confirmar
              </button>
            </div>
            
            <div className="mt-2">
               <div className="flex justify-between items-center mb-2">
                 <p className="text-xs text-slate-500 font-medium">Ícone do Evento (Opcional)</p>
                 <ImageUploadButton 
                   onImageSelected={setNewEventIcon} 
                   darkMode={darkMode} 
                   onError={(msg) => showToast('error', msg)}
                 />
               </div>
               <IconPicker selected={newEventIcon} onSelect={setNewEventIcon} />
            </div>
          </div>

          <ul className="space-y-3">
            {events.map((e: Event) => (
              <li key={e.id} className={`flex justify-between items-center p-4 rounded-xl border transition-colors ${darkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-600' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                <div 
                  className="flex-1 cursor-pointer flex items-center gap-4"
                  onClick={() => { setActiveEventId(e.id); setViewState('edit'); }}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${darkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                    {e.icon ? <DynamicIcon name={e.icon} size={24} /> : <Calendar size={24} />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                       <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-700'}`}>{e.name}</span>
                       <span className={`text-xs px-2 py-0.5 rounded border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                          {new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                       </span>
                       <span className={`text-xs px-2 py-0.5 rounded border ${isEventClosed(e) ? 'border-red-200 text-red-600 bg-red-50' : 'border-emerald-200 text-emerald-600 bg-emerald-50'} ${darkMode ? 'border-transparent' : ''}`}>
                          {isEventClosed(e) ? 'Prazo encerrado' : `Prazo: ${new Date(getEventDeadline(e) + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                       </span>
                    </div>
                    <span className="block text-xs text-slate-400 font-normal mt-1">Toque para editar</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteEvent(e.id)} className="text-slate-300 hover:text-red-500 p-2">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
            {events.length === 0 && (
              <li className="text-center text-sm text-slate-400 italic py-4">Nenhum evento criado.</li>
            )}
          </ul>
        </div>

        <section className={`p-6 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            <Lock size={18} /> Segurança
          </h3>
          <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Atualize a senha de administrador usada na tela inicial. Ela fica salva apenas no seu navegador.
          </p>
          {passwordFeedback && (
            <div className={`p-3 rounded-lg text-sm mb-4 ${passwordFeedback.type === 'success' ? (darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700') : (darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600')}`}>
              {passwordFeedback.message}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1">Senha Atual</label>
              <input 
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                className={`w-full p-3 border rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                placeholder="Senha atual"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1">Nova Senha</label>
              <input 
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className={`w-full p-3 border rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                placeholder="Mínimo 4 caracteres"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-1">Confirmar Nova Senha</label>
              <input 
                type="password"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                className={`w-full p-3 border rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <button 
            onClick={handlePasswordChange}
            className={`${BUTTON_BASE_CLASS} w-full mt-4 py-3 text-white ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-800 hover:bg-slate-900'}`}
          >
            <CheckCircle2 size={18} /> Atualizar Senha
          </button>
        </section>

        <div className={`pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button 
            onClick={onReset}
            className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            Apagar Tudo (Reset Completo)
          </button>
        </div>
      </div>
    );
  }

  // Edit View (Single Event)
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setViewState('list'); setEditingGroupId(null); }}
            className={`p-2 rounded-full ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <ArrowLeft size={24} />
          </button>
          <div className="overflow-hidden">
             <h2 className={`text-xl font-bold truncate max-w-[200px] ${darkMode ? 'text-white' : 'text-slate-800'}`}>{currentEvent.name}</h2>
             <p className="text-xs text-slate-500">{new Date(currentEvent.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
          <button 
            onClick={() => { setViewState('list'); setEditingGroupId(null); }}
            className={`${BUTTON_BASE_CLASS} bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs shadow-sm`}
          >
          <CheckCircle size={14} /> Concluir Edição
        </button>
      </div>

      <section className={`p-5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <ImageIcon size={18} /> Identidade do Evento
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {currentEvent.icon 
              ? <DynamicIcon name={currentEvent.icon} size={48} className="text-indigo-500" /> 
              : <Calendar size={36} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />}
          </div>
          <div className="flex-1 w-full">
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Escolha um ícone ou envie uma imagem</p>
            <IconPicker selected={currentEvent.icon} onSelect={updateEventIcon} />
            <div className="mt-3 flex flex-wrap gap-2">
              <ImageUploadButton 
                onImageSelected={updateEventIcon} 
                darkMode={darkMode}
                onError={(msg) => showToast('error', msg)}
              />
              <span className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Recomendado: imagens quadradas até 256px.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`p-5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Calendar size={18} /> Agenda e Prazo
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-2">Data do Evento</label>
            <input
              type="date"
              value={currentEvent.date}
              onChange={(e) => updateEventDate(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 block mb-2">Prazo para Respostas</label>
            <input
              type="date"
              value={getEventDeadline(currentEvent)}
              min={currentEvent.date}
              onChange={(e) => updateEventDeadline(e.target.value)}
              className={`w-full p-3 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
            />
            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Após esse dia os avaliadores não poderão enviar novas notas, mas o evento aparecerá em “Eventos passados”.</p>
          </div>
        </div>
      </section>

      {/* Groups Section */}
      <section className={`p-5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Users size={18} /> Grupos Participantes
        </h3>
        
        <div className="mb-4">
           <div className="flex gap-2 mb-2">
             <input 
               type="text" 
               placeholder="Nome do Novo Grupo"
               className={`flex-1 p-2 border rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
               value={newItemName}
               onChange={(e) => setNewItemName(e.target.value)}
             />
             <ImageUploadButton 
               onImageSelected={setNewItemIcon} 
               darkMode={darkMode}
               onError={(msg) => showToast('error', msg)}
             />
             <button 
               onClick={handleAddGroup} 
               className={`${BUTTON_BASE_CLASS} text-sm text-white px-4 shadow-sm active:scale-95 ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-slate-900'}`}
             >
               <Check size={16} /> Confirmar
             </button>
           </div>
           <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 font-medium mb-2">Escolher ícone do grupo</summary>
              <IconPicker selected={newItemIcon} onSelect={setNewItemIcon} />
           </details>
        </div>

        <ul className="space-y-3 max-h-[600px] overflow-y-auto">
          {currentGroups.map((g: Group) => {
             const isEditing = editingGroupId === g.id;
             return (
               <li key={g.id} className={`rounded-lg border transition-all ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'} ${isEditing ? (darkMode ? 'border-slate-600' : 'border-slate-400 shadow-sm') : ''}`}>
                 <div className="flex justify-between items-center p-3">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setEditingGroupId(isEditing ? null : g.id)}>
                      <div className={`p-1.5 rounded flex-shrink-0 ${darkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                        {g.icon ? <DynamicIcon name={g.icon} size={20} /> : <Users size={20} />}
                      </div>
                      <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{g.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                        {g.members.length} membros
                      </span>
                    </div>
                    <div className="flex items-center">
                       <button onClick={() => setEditingGroupId(isEditing ? null : g.id)} className="p-2 text-slate-400">
                         {isEditing ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                       </button>
                       <button 
                          onClick={() => setGroups(groups.filter((x: Group) => x.id !== g.id))}
                          className="text-red-300 hover:text-red-500 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                    </div>
                 </div>
                 
                 {isEditing && (
                   <div className={`p-3 pt-0 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                     <div className="py-3">
                       <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ícone / Imagem do Grupo</p>
                       <div className="flex flex-col sm:flex-row gap-4 items-center">
                         <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                           {g.icon
                             ? <DynamicIcon name={g.icon} size={40} />
                             : <Users size={28} className={darkMode ? 'text-slate-500' : 'text-slate-400'} />}
                         </div>
                         <div className="flex-1 w-full">
                           <IconPicker selected={g.icon} onSelect={(iconName) => updateGroupIcon(g.id, iconName)} />
                           <div className="mt-2">
                             <ImageUploadButton 
                               onImageSelected={(img) => updateGroupIcon(g.id, img)} 
                               darkMode={darkMode} 
                               onError={(msg) => showToast('error', msg)}
                             />
                           </div>
                         </div>
                       </div>
                     </div>
                      <p className="text-xs text-slate-500 mb-2 mt-2 font-medium uppercase">Participantes</p>
                      <ul className="space-y-2 mb-3">
                        {g.members.map(m => (
                          <li key={m.id} className={`flex justify-between items-center px-3 py-2 rounded border text-sm gap-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                {m.icon ? <DynamicIcon name={m.icon} size={20} /> : <User size={18} className="text-slate-400"/>}
                              </div>
                              <span className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-600'}`}>{m.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const baseIcon = (typeof m.icon === 'string' && !m.icon?.startsWith('data:')) ? m.icon : 'User';
                                  const currIdx = MEMBER_ICON_CHOICES.indexOf(baseIcon as (typeof MEMBER_ICON_CHOICES)[number]);
                                  const nextIcon = MEMBER_ICON_CHOICES[(currIdx + 1) % MEMBER_ICON_CHOICES.length];
                                  updateMemberIcon(g.id, m.id, nextIcon);
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-semibold border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                              >
                                Ícone
                              </button>
                              <ImageUploadButton 
                                onImageSelected={(img) => updateMemberIcon(g.id, m.id, img)}
                                darkMode={darkMode}
                                className="px-2 py-1 text-[11px]"
                                label="Img"
                                onError={(msg) => showToast('error', msg)}
                              />
                              <button onClick={() => handleRemoveMember(g.id, m.id)} className="text-slate-400 hover:text-red-500 p-1">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2 items-center">
                         <div className="relative">
                           <button 
                              onClick={() => {
                                const baseIcon = (typeof newMemberIcon === 'string' && !newMemberIcon.startsWith('data:')) ? newMemberIcon : 'User';
                                const currIdx = MEMBER_ICON_CHOICES.indexOf(baseIcon);
                                const nextIcon = MEMBER_ICON_CHOICES[(currIdx + 1) % MEMBER_ICON_CHOICES.length];
                                setNewMemberIcon(nextIcon);
                              }}
                              className={`p-2 rounded border h-9 w-9 flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'}`}
                              title="Toque para mudar ícone"
                           >
                              <DynamicIcon name={newMemberIcon || 'User'} size={16} />
                           </button>
                         </div>
                        <input 
                           type="text"
                           placeholder="Nome do aluno"
                           className={`flex-1 p-2 border rounded text-sm h-9 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                           value={newMemberName}
                           onChange={(e) => setNewMemberName(e.target.value)}
                           onKeyDown={(e) => {
                             if(e.key === 'Enter') handleAddMember(g.id);
                           }}
                        />
                        <ImageUploadButton 
                          onImageSelected={(b64) => setNewMemberIcon(b64)} 
                          darkMode={darkMode} 
                          className="h-9"
                          onError={(msg) => showToast('error', msg)}
                        />
                        <button onClick={() => handleAddMember(g.id)} className={`px-3 rounded text-sm h-9 ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-800'}`}>
                           Add
                        </button>
                      </div>
                   </div>
                 )}
               </li>
             );
          })}
          {currentGroups.length === 0 && <li className="text-xs text-slate-400 italic">Nenhum grupo neste evento.</li>}
        </ul>
      </section>

      {/* Criteria Section */}
      <section className={`p-5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Settings size={18} /> Critérios de Avaliação
        </h3>
        
        <div className={`space-y-2 mb-4 p-3 rounded-lg ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <input 
            type="text" 
            placeholder="Nome do Critério"
            className={`w-full p-2 border rounded-lg text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <textarea 
            placeholder="Descrição para ajudar o avaliador..."
            className={`w-full p-2 border rounded-lg text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
            rows={2}
            value={newItemDesc}
            onChange={(e) => setNewItemDesc(e.target.value)}
          />
          <button onClick={handleAddCriteria} className="w-full bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold uppercase tracking-wide">
            Adicionar Critério
          </button>
        </div>

        <ul className="space-y-3">
          {currentCriteria.map((c: Criterion) => (
            <li key={c.id} className={`p-3 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`font-semibold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{c.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                </div>
                <button 
                  onClick={() => setCriteria(criteria.filter((x: Criterion) => x.id !== c.id))}
                  className="text-slate-300 hover:text-red-500 ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);