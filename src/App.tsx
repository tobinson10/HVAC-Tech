/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, useCallback, useRef, useMemo, Component } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  MessageSquare, 
  ChevronRight, 
  User, 
  MapPin, 
  Clock,
  ArrowLeft,
  Sparkles,
  Send,
  Check,
  Plus,
  Activity,
  LogOut,
  LogIn,
  UserPlus,
  Home,
  History,
  Settings,
  Calendar,
  Menu,
  Bell,
  BellOff,
  X,
  Phone,
  Navigation,
  AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CHECKLIST_STEPS, Job, JobStepStatus, Message, Availability, Notification } from './types';
import { getSmartSuggestions } from './services/geminiService';
import { auth, db, handleFirestoreError, OperationType, sendNotification } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection, query, where, onSnapshot, updateDoc, orderBy, getDocs, limit } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Mock Data ---
const MOCK_JOBS: Job[] = [
  {
    id: 'JOB-101',
    customerId: 'MOCK-CUST-101',
    customerName: 'Sarah Jenkins',
    address: '123 Maple Ave, Springfield',
    systemType: 'Central AC - Carrier 3-Ton',
    status: 'scheduled',
    scheduledAt: '2026-03-22T10:00:00Z',
    technicianName: 'Mike Miller',
    technicianPhotoUrl: 'https://picsum.photos/seed/tech1/200/200',
    technicianBio: 'Master Technician • 12 yrs exp',
    steps: [],
    notes: ['Customer reports unit running but not cooling.', 'Last service: 14 months ago.']
  },
  {
    id: 'JOB-102',
    customerId: 'MOCK-CUST-102',
    customerName: 'Robert Chen',
    address: '456 Oak Lane, Riverside',
    systemType: 'Heat Pump - Trane XL18i',
    status: 'scheduled',
    scheduledAt: '2026-03-22T13:00:00Z',
    technicianName: 'Sarah Connor',
    technicianPhotoUrl: 'https://picsum.photos/seed/tech2/200/200',
    technicianBio: 'HVAC Specialist • 8 yrs exp',
    steps: [],
    notes: ['Strange noise from outdoor unit.', 'Filter changed last month.']
  },
  {
    id: 'JOB-103',
    customerId: 'MOCK-CUST-103',
    customerName: 'Maria Garcia',
    address: '789 Pine St, Downtown',
    systemType: 'Gas Furnace - Lennox Elite',
    status: 'scheduled',
    scheduledAt: '2026-03-23T09:00:00Z',
    technicianName: 'Mike Miller',
    technicianPhotoUrl: 'https://picsum.photos/seed/tech1/200/200',
    technicianBio: 'Master Technician • 12 yrs exp',
    steps: [],
    notes: ['Annual maintenance check.', 'System is 5 years old.']
  },
  {
    id: 'JOB-104',
    customerId: 'MOCK-CUST-104',
    customerName: 'James Wilson',
    address: '321 Birch Rd, Westside',
    systemType: 'Mini-Split - Mitsubishi Electric',
    status: 'scheduled',
    scheduledAt: '2026-03-23T14:00:00Z',
    technicianName: 'Sarah Connor',
    technicianPhotoUrl: 'https://picsum.photos/seed/tech2/200/200',
    technicianBio: 'HVAC Specialist • 8 yrs exp',
    steps: [],
    notes: ['Remote control not responding.', 'Unit is leaking water inside.']
  },
  {
    id: 'JOB-105',
    customerId: 'MOCK-CUST-105',
    customerName: 'Linda Thompson',
    address: '555 Cedar Blvd, North Hills',
    systemType: 'Central AC - Goodman 4-Ton',
    status: 'scheduled',
    steps: [],
    notes: ['Thermostat blank.', 'Check for blown fuse or transformer issue.']
  },
  {
    id: 'JOB-106',
    customerId: 'MOCK-CUST-106',
    customerName: 'David Kim',
    address: '888 Elm Ct, East End',
    systemType: 'Boiler System - Weil-McLain',
    status: 'scheduled',
    steps: [],
    notes: ['Radiators not heating up.', 'Pressure gauge reading low.']
  },
  {
    id: 'JOB-107',
    customerId: 'MOCK-CUST-107',
    customerName: 'Emily Davis',
    address: '222 Willow Way, South Park',
    systemType: 'Central AC - Rheem Classic',
    status: 'scheduled',
    steps: [],
    notes: ['Unit making a loud buzzing sound.', 'Fan not spinning.']
  },
  {
    id: 'JOB-108',
    customerId: 'MOCK-CUST-108',
    customerName: 'Michael Brown',
    address: '444 Oak St, Highland Park',
    systemType: 'Gas Furnace - York Affinity',
    status: 'scheduled',
    steps: [],
    notes: ['System cycling on and off frequently.', 'Check flame sensor and filter.']
  },
  {
    id: 'JOB-109',
    customerId: 'MOCK-CUST-109',
    customerName: 'Sarah Miller',
    address: '777 Pine Ln, Forest Hills',
    systemType: 'Heat Pump - American Standard',
    status: 'scheduled',
    steps: [],
    notes: ['Outdoor unit iced up.', 'Defrost cycle may be failing.']
  },
  {
    id: 'JOB-110',
    customerId: 'MOCK-CUST-110',
    customerName: 'Chris Johnson',
    address: '999 Maple Dr, Sunnyvale',
    systemType: 'Central AC - Bryant Evolution',
    status: 'scheduled',
    steps: [],
    notes: ['High humidity inside.', 'Check blower speed and coil condition.']
  }
];

// --- Auth Context ---
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'technician' | 'customer';
  technicianId?: string;
  address?: string;
  phoneNumber?: string;
  createdAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  userRole: 'technician' | 'customer' | null;
  loading: boolean;
  setBypassUser?: (role: 'technician' | 'customer') => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, userRole: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userRole, setUserRole] = useState<'technician' | 'customer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBypass, setIsBypass] = useState(false);

  const setBypassUser = useCallback((role: 'technician' | 'customer') => {
    setIsBypass(true);
    setUserRole(role);
    setUserData({
      uid: 'bypass-user-id',
      email: 'bypass@example.com',
      displayName: role === 'technician' ? 'Demo Technician' : 'Demo Customer',
      role: role,
      technicianId: role === 'technician' ? 'TECH-DEMO' : undefined,
      createdAt: new Date().toISOString() as any
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    console.log("AuthProvider: Auth effect running, isBypass:", isBypass);
    if (isBypass) return;
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthProvider: onAuthStateChanged fired, user:", firebaseUser?.email, "uid:", firebaseUser?.uid);
      setUser(firebaseUser);
      
      if (unsubscribeDoc) {
        console.log("AuthProvider: Cleaning up previous onSnapshot");
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (firebaseUser) {
        // Check if user is an admin by email
        const isAdminEmail = firebaseUser.email === 'tobinson10@gmail.com' || firebaseUser.email === 'salawumoshood86@gmail.com';
        console.log("AuthProvider: User is admin by email:", isAdminEmail);
        
        // Use onSnapshot for real-time updates to user data
        console.log("AuthProvider: Setting up onSnapshot for users/", firebaseUser.uid);
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
          console.log("AuthProvider: onSnapshot received data, exists:", doc.exists());
          if (doc.exists()) {
            const data = doc.data() as UserData;
            console.log("AuthProvider: User data found, role:", data.role);
            setUserData(data);
            setUserRole(data.role);
          } else {
            console.log("AuthProvider: User document does not exist in Firestore");
            setUserData(null);
            // If user doc doesn't exist but it's an admin email, treat as technician
            if (isAdminEmail) {
              console.log("AuthProvider: Admin email detected, assigning technician role");
              setUserRole('technician');
            } else {
              setUserRole(null);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("AuthProvider: Error fetching user data from Firestore:", error);
          // Even if fetch fails, if it's an admin email, we can try to let them in
          if (isAdminEmail) {
            console.log("AuthProvider: Error occurred but admin email detected, assigning technician role");
            setUserRole('technician');
          }
          setLoading(false);
        });
      } else {
        console.log("AuthProvider: No firebaseUser found, clearing state");
        setUserData(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    // Safety timeout to prevent stuck loading
    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("AuthProvider: Safety timeout fired, forcing loading to false");
          return false;
        }
        return prev;
      });
    }, 8000);

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      clearTimeout(timeoutId);
    };
  }, [isBypass]);

  const value = useMemo(() => ({ 
    user, 
    userData, 
    userRole, 
    loading, 
    setBypassUser 
  }), [user, userData, userRole, loading, setBypassUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// --- Components ---

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-md w-full p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Application Error</h2>
            <p className="text-sm text-slate-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

const NotificationCenter = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isOpen) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isOpen]);

  const markAsRead = async (notifId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
        read: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${notifId}`);
    }
  };

  const handleNotifClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.jobId) {
      navigate('/history');
    }
    onClose();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true })
      ));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative bg-white w-full max-w-md h-[70vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 leading-tight">Notifications</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Stay updated on your service</p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.read) && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching updates...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <BellOff size={32} />
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2">All caught up!</h4>
              <p className="text-sm text-slate-400 font-medium">You don't have any notifications at the moment.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all border flex gap-4 group active:scale-[0.98]",
                  notif.read 
                    ? "bg-white border-slate-100 opacity-75" 
                    : "bg-white border-blue-100 shadow-sm ring-1 ring-blue-50"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  notif.type === 'success' ? "bg-emerald-100 text-emerald-600" :
                  notif.type === 'warning' ? "bg-amber-100 text-amber-600" :
                  notif.type === 'error' ? "bg-rose-100 text-rose-600" :
                  "bg-blue-100 text-blue-600"
                )}>
                  {notif.type === 'success' ? <CheckCircle2 size={24} /> :
                   notif.type === 'warning' ? <AlertTriangle size={24} /> :
                   notif.type === 'error' ? <AlertCircle size={24} /> :
                   <Bell size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={cn(
                      "font-black text-sm truncate",
                      notif.read ? "text-slate-600" : "text-slate-800"
                    )}>{notif.title}</h4>
                    {!notif.read && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                  </div>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-2 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ChatModal = ({ jobId, isOpen, onClose, recipientName }: { jobId: string, isOpen: boolean, onClose: () => void, recipientName: string }) => {
  const { user, userRole } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId || !isOpen) return;

    const q = query(
      collection(db, 'jobs', jobId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `jobs/${jobId}/messages`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [jobId, isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msgData = {
      senderId: user.uid,
      senderName: user.displayName || 'User',
      text: newMessage.trim(),
      createdAt: serverTimestamp()
    };

    setNewMessage('');
    try {
      await addDoc(collection(db, 'jobs', jobId, 'messages'), msgData);
      
      // Send notification to recipient
      if (userRole === 'technician') {
        // Find job to get customerId
        const jobDoc = await getDoc(doc(db, 'jobs', jobId));
        if (jobDoc.exists()) {
          const jobData = jobDoc.data() as Job;
          await sendNotification(
            jobData.customerId,
            "New Message",
            `Your technician sent you a message: "${newMessage.trim().substring(0, 50)}${newMessage.length > 50 ? '...' : ''}"`,
            'info',
            jobId
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `jobs/${jobId}/messages`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative bg-white w-full max-w-md h-[80vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 leading-tight">{recipientName}</h3>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Online</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <Clock className="animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-200">
                <MessageSquare size={32} />
              </div>
              <p className="text-sm text-slate-400 font-medium">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.senderId === user?.uid ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-sm font-medium shadow-sm",
                  msg.senderId === user?.uid 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                )}>
                  {msg.text}
                </div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-slate-100 bg-white shrink-0">
          <div className="flex gap-2">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: 'technician' | 'customer' }) => {
  const { user, userRole, loading, setBypassUser } = useAuth();
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setShowReset(true);
      }, 5000);
    } else {
      setShowReset(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verifying Access...</p>
          {showReset && (
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Taking too long? Reload
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  
  // If we have a user but no role yet, it might be loading or they might not have a profile
  if (role && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Profile...</p>
          <button 
            onClick={() => setBypassUser(role)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
          >
            Skip to Demo {role}
          </button>
        </div>
      </div>
    );
  }

  if (role && userRole !== role) return <Navigate to="/" />;
  return <>{children}</>;
};

const Header = ({ title, showBack = false, transparent = false }: { title: string; showBack?: boolean; transparent?: boolean }) => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || userRole !== 'customer') return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <>
      <header className={cn(
        "sticky top-0 z-50 px-4 py-3 flex items-center justify-between transition-all duration-300",
        transparent ? "bg-transparent" : "bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm",
        "pt-[env(safe-area-inset-top,12px)]"
      )}>
        <div className="flex items-center gap-3">
          {showBack && (
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
            >
              <ArrowLeft size={20} className={transparent ? "text-white" : "text-slate-600"} />
            </button>
          )}
          <div className="flex items-center gap-2">
            {!showBack && <Shield className={transparent ? "text-white" : "text-blue-600"} size={24} />}
            <h1 className={cn(
              "font-extrabold text-lg tracking-tight",
              transparent ? "text-white" : "text-slate-800"
            )}>{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && userRole === 'customer' && (
            <button 
              onClick={() => setIsNotifOpen(true)}
              className={cn(
                "p-2 rounded-full transition-all active:scale-95 relative",
                transparent ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
              )}
            </button>
          )}
          {user && (
            <button 
              onClick={handleLogout} 
              className={cn(
                "p-2 rounded-full transition-all active:scale-95",
                transparent ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )} 
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};

const MobileNav = ({ activeTab }: { activeTab: string }) => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const tabs = userRole === 'technician' ? [
    { id: 'jobs', label: 'Jobs', icon: Calendar, path: '/tech' },
    { id: 'activity', label: 'Activity', icon: Activity, path: '/tech' },
    { id: 'profile', label: 'Profile', icon: User, path: '/tech' },
  ] : [
    { id: 'home', label: 'Home', icon: Home, path: '/customer-home' },
    { id: 'history', label: 'History', icon: History, path: '/customer-home' },
    { id: 'support', label: 'Support', icon: Phone, path: '/customer-home' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 pb-[env(safe-area-inset-bottom,16px)] pt-3 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => navigate(tab.path)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            activeTab === tab.id ? "text-blue-600" : "text-slate-400"
          )}
        >
          <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          {activeTab === tab.id && (
            <motion.div 
              layoutId="activeTab"
              className="w-1 h-1 bg-blue-600 rounded-full mt-0.5"
            />
          )}
        </button>
      ))}
    </nav>
  );
};

const PageLayout = ({ 
  children, 
  title, 
  showBack = false, 
  activeTab, 
  transparentHeader = false,
  className 
}: { 
  children: React.ReactNode; 
  title: string; 
  showBack?: boolean; 
  activeTab?: string;
  transparentHeader?: boolean;
  className?: string;
}) => {
  return (
    <div className={cn("min-h-screen bg-slate-50 flex flex-col pb-24", className)}>
      <Header title={title} showBack={showBack} transparent={transparentHeader} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {activeTab && <MobileNav activeTab={activeTab} />}
    </div>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 p-4", className)}>
    {children}
  </div>
);

// --- Views ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [techId, setTechId] = useState('');
  const [isTechLogin, setIsTechLogin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();
  const { user, userRole, setBypassUser } = useAuth();

  useEffect(() => {
    if (userRole) {
      if (showSuccessModal) {
        const timer = setTimeout(() => {
          setShowSuccessModal(false);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        navigate(userRole === 'technician' ? '/tech' : '/customer-home');
      }
    }
  }, [userRole, navigate, showSuccessModal]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isTechLogin && !techId.trim()) {
      setError('Technician ID is required.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Verify technician ID if it's a tech login
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        if (data.role === 'technician') {
          // If they are on the tech tab, verify the ID
          if (isTechLogin) {
            if (!data.technicianId || data.technicianId !== techId.trim().toUpperCase()) {
              await signOut(auth);
              setError('Invalid Technician ID. Please try again.');
              setLoading(false);
              return;
            }
          }
          // If they are on the customer tab, we'll just let them in and the useEffect will redirect them
        } else if (isTechLogin) {
          await signOut(auth);
          setError('This account is not a technician account.');
          setLoading(false);
          return;
        }
      } else {
        // User exists in Auth but not in Firestore
        await signOut(auth);
        setError('User profile not found. Please register first.');
        setLoading(false);
        return;
      }
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user document exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // If user doesn't exist, create as customer by default
        // If they want to be a technician, they should register on the register page
        const userData: UserData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Customer',
          role: 'customer',
          createdAt: serverTimestamp(),
        };
        
        try {
          await setDoc(doc(db, 'users', user.uid), userData);
          setShowSuccessModal(true);
        } catch (fsError) {
          handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        // If user exists, the useEffect will handle navigation
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Google Sign-In error:", err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Login Successful!</h3>
              <p className="text-slate-500 font-medium">Welcome back to HVAC Shield. Redirecting you now...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Shield className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
          <p className="text-slate-500 text-sm">Sign in to your HVAC Shield account</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setIsTechLogin(false)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              !isTechLogin ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            )}
          >
            Customer
          </button>
          <button 
            type="button"
            onClick={() => setIsTechLogin(true)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              isTechLogin ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            )}
          >
            Technician
          </button>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-bold">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="mike@hvac.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          {isTechLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Technician ID</label>
              <input 
                type="text" 
                required
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold"
                placeholder="TECH-1234"
              />
            </motion.div>
          )}

          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Clock className="animate-spin" size={18} /> : <LogIn size={18} />}
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-slate-500">
            Don't have an account? <Link to="/register" className="text-blue-600 font-bold hover:underline">Register here</Link>
          </p>
          {!isTechLogin && (
            <div className="flex flex-col items-center space-y-4">
              <button 
                onClick={() => setIsTechLogin(true)}
                className="text-xs text-slate-400 font-bold hover:text-blue-600 transition-colors uppercase tracking-widest"
              >
                Technician Portal Access
              </button>
              <button 
                onClick={() => setBypassUser?.('technician')}
                className="text-[10px] text-emerald-500 font-black hover:text-emerald-600 transition-colors uppercase tracking-widest border border-emerald-100 px-3 py-1 rounded-full bg-emerald-50"
              >
                ⚡ Dev: Artificial Tech Login
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'technician' | 'customer'>('customer');
  const [techId, setTechId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredTechId, setRegisteredTechId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (userRole && !registeredTechId) {
      if (showSuccessModal) {
        const timer = setTimeout(() => {
          setShowSuccessModal(false);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        navigate(userRole === 'technician' ? '/tech' : '/customer-home');
      }
    }
  }, [userRole, navigate, showSuccessModal, registeredTechId]);

  const generateTechId = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TECH-${random}`;
  };

  useEffect(() => {
    if (role === 'technician' && !techId) {
      setTechId(generateTechId());
    } else if (role === 'customer') {
      setTechId(null);
    }
  }, [role]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const finalTechId = role === 'technician' ? (techId || generateTechId()) : undefined;

      const userData: UserData = {
        uid: user.uid,
        email: email,
        displayName: name,
        role: role,
        technicianId: finalTechId,
        createdAt: serverTimestamp(),
      };

      if (role === 'customer') {
        userData.address = address;
        userData.phoneNumber = phone;
      }

      try {
        await setDoc(doc(db, 'users', user.uid), userData);
        setShowSuccessModal(true);
        if (role === 'technician') {
          setTimeout(() => {
            setRegisteredTechId(finalTechId!);
            setShowSuccessModal(false);
            setLoading(false);
          }, 2000);
          return; // Don't navigate yet, show the ID
        }
      } catch (fsError) {
        await signOut(auth);
        handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
        return;
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || 'Failed to register. Please try again.');
      if (auth.currentUser) await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user document exists, if not create one with selected role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const generatedId = techId || generateTechId();
        const userData: UserData = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || name || 'User',
          role: role as 'technician' | 'customer',
          createdAt: serverTimestamp(),
          ...(role === 'technician' ? { technicianId: generatedId } : {})
        };
        if (role === 'customer') {
          userData.address = address;
          userData.phoneNumber = phone;
        }
        try {
          await setDoc(doc(db, 'users', user.uid), userData);
          setShowSuccessModal(true);
          if (role === 'technician') {
            setTimeout(() => {
              setRegisteredTechId(generatedId);
              setShowSuccessModal(false);
              setLoading(false);
            }, 2000);
            return;
          }
        } catch (fsError) {
          await signOut(auth);
          handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
          return;
        }
      } else {
        // If user exists, check if they are a technician and show their ID if needed
        const data = userDoc.data() as UserData;
        if (role === 'technician' && data.role === 'technician' && data.technicianId) {
          setRegisteredTechId(data.technicianId);
          setLoading(false);
          return;
        }
        // Otherwise just show success and let useEffect handle navigation
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error("Google Sign-In error:", err);
      setError(err.message || 'Failed to sign in with Google.');
      if (auth.currentUser) await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  if (registeredTechId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800">Registration Successful!</h2>
            <p className="text-slate-500 font-medium">Your unique Technician ID has been generated.</p>
          </div>
          
          <div className="bg-slate-100 p-6 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Your Technician ID</p>
            <p className="text-4xl font-black text-blue-600 tracking-tight">{registeredTechId}</p>
          </div>

          <p className="text-sm text-slate-500 bg-amber-50 p-4 rounded-xl border border-amber-100 text-left">
            <span className="font-bold text-amber-800 block mb-1">Important:</span>
            Please save this ID. You will be required to enter it every time you log in to the Technician Portal.
          </p>

          <button 
            onClick={() => navigate('/tech')}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
          >
            Go to Technician Portal
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Registration Successful!</h3>
              <p className="text-slate-500 font-medium">Welcome to HVAC Shield. Redirecting you now...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Shield className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Create Account</h2>
          <p className="text-slate-500 text-sm">Join the HVAC Shield network</p>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 mb-6"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-bold">Or register with email</span>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button 
              type="button"
              onClick={() => setRole('customer')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                role === 'customer' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              Customer
            </button>
            <button 
              type="button"
              onClick={() => setRole('technician')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                role === 'technician' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              )}
            >
              Technician
            </button>
          </div>

          {role === 'technician' && techId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4"
            >
              <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Your Assigned Technician ID</label>
              <p className="text-2xl font-black text-blue-600">{techId}</p>
              <p className="text-[10px] text-blue-500 mt-1 font-medium italic">Save this ID! You'll need it to log in every time.</p>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          {role === 'customer' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Service Address</label>
                <input 
                  type="text" 
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="123 Maple Ave, Springfield"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="(555) 000-0000"
                />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Clock className="animate-spin" size={18} /> : <UserPlus size={18} />}
            Register
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account? <Link to="/login" className="text-blue-600 font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

const BookTuneUpModal = ({ isOpen, onClose, onBooked, prefill }: { isOpen: boolean, onClose: () => void, onBooked: () => void, prefill?: { customerId: string, customerName: string, address: string } }) => {
  const { userData } = useAuth();
  const [systemType, setSystemType] = useState('AC System');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const customerId = userData?.uid || prefill?.customerId;
    const customerName = userData?.displayName || prefill?.customerName;
    const address = userData?.address || prefill?.address;

    if (!customerId) {
      setError('User information missing. Please log in.');
      return;
    }
    if (!date || !time) {
      setError('Please select a date and time.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const jobId = `JOB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const jobData = {
        id: jobId,
        customerId,
        customerName: customerName || 'Customer',
        address: address || 'Service Address',
        systemType,
        status: 'scheduled',
        scheduledAt: `${date}T${time}:00`,
        createdAt: serverTimestamp(),
        notes: notes ? [notes] : [],
        steps: [],
      };

      await addDoc(collection(db, 'jobs'), jobData);
      onBooked();
      onClose();
    } catch (err: any) {
      console.error("Booking error:", err);
      setError(err.message || 'Failed to book tune-up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Book Tune-up</h3>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBook} className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Type</label>
                <select 
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                >
                  <option>AC System</option>
                  <option>Heating System</option>
                  <option>Heat Pump</option>
                  <option>Ductless Mini-Split</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Time</label>
                  <input 
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Special Requests / Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Unit is in the attic, gate code is 1234..."
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 min-h-[100px] outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
};

const TechMap = ({ location, customerAddress }: { location: { lat: number, lng: number }, customerAddress: string }) => {
  return (
    <div className="h-[200px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-100 relative">
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={15} 
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={[location.lat, location.lng]} />
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            Technician is here
          </Popup>
        </Marker>
      </MapContainer>
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-white flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Live Tracking</span>
      </div>
    </div>
  );
};

const CustomerHome = () => {
  const { user, userData } = useAuth();
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedJobNotification, setCompletedJobNotification] = useState<Job | null>(null);
  const prevJobsRef = useRef<Job[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, 'jobs'), where('customerId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Job[];
      
      // Check for newly completed jobs
      if (prevJobsRef.current.length > 0) {
        const newlyCompleted = jobs.find(j => 
          j.status === 'completed' && 
          prevJobsRef.current.find(pj => pj.id === j.id && pj.status !== 'completed')
        );
        if (newlyCompleted) {
          setCompletedJobNotification(newlyCompleted);
        }
      }

      prevJobsRef.current = jobs;
      setUserJobs(jobs);
      
      // Find the most recent active job (scheduled or in-progress)
      const active = jobs.find(j => j.status === 'in-progress' || j.status === 'scheduled');
      
      // Only update active job if it's different to prevent loops
      setActiveJob(prev => {
        if (!active && !prev) return null;
        if (active && prev && active.id === prev.id && active.status === prev.status) return prev;
        return active || null;
      });
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    // Keep mock job for Sarah demo if no real jobs exist
    if (user?.displayName?.includes('Sarah') && userJobs.length === 0) {
      setActiveJob(prev => {
        if (prev?.id === MOCK_JOBS[0].id) return prev;
        return MOCK_JOBS[0];
      });
    }
  }, [user?.displayName, userJobs.length]);

  return (
    <PageLayout title="My HVAC Shield" activeTab="home">
      <div className="p-4 max-w-md mx-auto space-y-8">
        {/* Notification Banner */}
        <AnimatePresence>
          {completedJobNotification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-1"
            >
              <Card className="bg-emerald-600 text-white border-none shadow-xl shadow-emerald-900/20 p-4 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <Bell size={64} />
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div className="flex-1 pr-8">
                  <h4 className="font-black text-sm">Service Completed!</h4>
                  <p className="text-[10px] font-medium text-emerald-100">
                    Mike Miller has finished the {completedJobNotification.systemType} service.
                  </p>
                </div>
                <button 
                  onClick={() => setCompletedJobNotification(null)}
                  className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
                <Link 
                  to={`/customer/history/${completedJobNotification.id}`}
                  className="absolute bottom-4 right-4 text-[10px] font-black uppercase tracking-widest bg-white text-emerald-600 px-3 py-1 rounded-full shadow-lg active:scale-95 transition-all"
                  onClick={() => setCompletedJobNotification(null)}
                >
                  View Report
                </Link>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        {/* User Greeting & Address */}
        <section className="space-y-1 px-1">
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Hello, {userData?.displayName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'Friend'} 👋
          </h2>
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin size={14} className="text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">{userData?.address || activeJob?.address || "123 Maple Ave, Springfield"}</span>
          </div>
          {userData?.phoneNumber && (
            <div className="flex items-center gap-2 text-slate-400 mt-1">
              <Phone size={12} className="text-slate-300" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{userData.phoneNumber}</span>
            </div>
          )}
        </section>

        {/* Active Job Status */}
        <section className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center space-y-4 border-none shadow-sm">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading your status...</p>
            </Card>
          ) : activeJob ? (
            <div className="space-y-4">
              <Link to={`/customer/job/${activeJob.id}`}>
                <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-xl shadow-blue-900/10 p-6 relative overflow-hidden group active:scale-[0.98] transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Shield size={120} />
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {activeJob.status === 'in-progress' ? 'Live Tracking' : 'Upcoming Service'}
                      </div>
                      {activeJob.scheduledAt && (
                        <div className="flex items-center gap-1 text-blue-100 text-[10px] font-bold uppercase">
                          <Clock size={12} /> {new Date(activeJob.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    
                    {activeJob.status === 'in-progress' && activeJob.techLocation && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        <TechMap 
                          location={activeJob.techLocation} 
                          customerAddress={activeJob.address} 
                        />
                      </div>
                    )}

                    <div>
                      <h3 className="text-xl font-extrabold mb-1">{activeJob.systemType}</h3>
                      <p className="text-blue-100 text-sm font-medium">
                        {activeJob.status === 'in-progress' 
                          ? "Technician is currently on-site performing diagnostics." 
                          : `Scheduled for ${new Date(activeJob.scheduledAt || '').toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center gap-2 text-xs font-bold">
                      View Details <ChevronRight size={14} />
                    </div>
                  </div>
                </Card>
              </Link>
              
              <div className="space-y-4">
                <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] px-1">Quick Actions</h3>
                <button 
                  onClick={() => setShowBookingModal(true)}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-black/10"
                >
                  <Plus size={20} strokeWidth={3} />
                  Book a Tune-up
                </button>
              </div>
            </div>
          ) : (
            <Card className="bg-white border-dashed border-2 border-slate-200 p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="text-slate-300" size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-slate-800">Everything looks good!</h3>
                <p className="text-slate-500 text-sm">No active service calls at the moment.</p>
              </div>
              <button 
                onClick={() => setShowBookingModal(true)}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-extrabold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-black/5"
              >
                Book a Tune-up
              </button>
            </Card>
          )}
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-4">
          <Card className="p-5 border-none shadow-sm space-y-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Health</p>
              <p className="text-lg font-black text-slate-800">Optimal</p>
            </div>
          </Card>
          <Card className="p-5 border-none shadow-sm space-y-3">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next Service</p>
              <p className="text-lg font-black text-slate-800">Oct 2026</p>
            </div>
          </Card>
        </section>

        {/* Service History */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em]">Service History</h3>
            <button className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {userJobs.length > 0 ? (
              userJobs.map((job) => (
                <div key={job.id}>
                  <Link to={job.status === 'completed' ? `/customer/history/${job.id}` : `/customer/job/${job.id}`}>
                    <Card className="flex items-center justify-between p-5 border-none shadow-sm active:scale-[0.98] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                          <History size={24} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">{job.systemType}</h4>
                          <p className="text-xs font-bold text-slate-400">
                            {job.status === 'completed' ? 'Completed' : 'Scheduled for'} {job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString() : 'TBD'}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        job.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                        job.status === 'in-progress' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {job.status}
                      </div>
                    </Card>
                  </Link>
                </div>
              ))
            ) : (
              MOCK_JOBS.slice(0, 3).map((job, idx) => (
                <div key={job.id}>
                  <Card className="flex items-center justify-between p-5 border-none shadow-sm opacity-60">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                        <History size={24} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{job.systemType} (Sample)</h4>
                        <p className="text-xs font-bold text-slate-400">Completed Jan 12, 2024</p>
                      </div>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Done
                    </div>
                  </Card>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Support CTA */}
        <section className="pb-12">
          <Card className="bg-slate-900 text-white p-6 border-none shadow-xl shadow-black/10 flex items-center justify-between group active:scale-[0.98] transition-all">
            <div className="space-y-1">
              <h3 className="font-extrabold text-lg leading-tight">Need Support?</h3>
              <p className="text-slate-400 text-xs font-medium">24/7 Emergency HVAC Assistance</p>
            </div>
            <button className="bg-white text-slate-900 w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Phone size={20} />
            </button>
          </Card>
        </section>

        <BookTuneUpModal 
          isOpen={showBookingModal} 
          onClose={() => setShowBookingModal(false)}
          onBooked={() => {
            setBookingSuccess(true);
            setTimeout(() => setBookingSuccess(false), 5000);
          }}
        />

        <AnimatePresence>
          {bookingSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-24 left-4 right-4 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3"
            >
              <div className="bg-white/20 p-2 rounded-full">
                <Check size={20} />
              </div>
              <div>
                <p className="font-black text-sm">Booking Confirmed!</p>
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">We'll see you soon.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
};

const AvailabilitySettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const days: Availability['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (!user) return;

    const fetchAvailability = async () => {
      try {
        const q = query(collection(db, 'users', user.uid, 'availability'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data() as Availability);
        
        // Initialize with default if not found
        const fullAvailability = days.map(day => {
          const existing = data.find(a => a.day === day);
          return existing || { day, startTime: '09:00', endTime: '17:00', isActive: true };
        });
        
        setAvailability(fullAvailability);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/availability`);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [user]);

  const handleToggle = (day: string) => {
    setAvailability(prev => prev.map(a => a.day === day ? { ...a, isActive: !a.isActive } : a));
  };

  const handleTimeChange = (day: string, field: 'startTime' | 'endTime', value: string) => {
    setAvailability(prev => prev.map(a => a.day === day ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const batch = availability.map(a => 
        setDoc(doc(db, 'users', user.uid, 'availability', a.day), a)
      );
      await Promise.all(batch);
      navigate('/tech');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/availability`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Set Availability" showBack activeTab="settings">
      <div className="p-4 max-w-md mx-auto space-y-6 pb-24">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Working Hours</h2>
          <p className="text-slate-500 text-sm font-medium">Set your available days and hours for service calls.</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold">Loading availability...</div>
        ) : (
          <div className="space-y-4">
            {availability.map((item) => (
              <div key={item.day}>
                <Card className={cn("p-5 border-none shadow-sm transition-all", !item.isActive && "opacity-50 grayscale")}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs", item.isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
                        {item.day.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-800">{item.day}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {item.isActive ? 'Available' : 'Unavailable'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleToggle(item.day)}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-colors",
                        item.isActive ? "bg-blue-600" : "bg-slate-200"
                      )}
                    >
                      <motion.div 
                        animate={{ x: item.isActive ? 24 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>

                  {item.isActive && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                        <input 
                          type="time" 
                          value={item.startTime}
                          onChange={(e) => handleTimeChange(item.day, 'startTime', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                        <input 
                          type="time" 
                          value={item.endTime}
                          onChange={(e) => handleTimeChange(item.day, 'endTime', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none font-bold text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </PageLayout>
  );
};

const TechDashboard = () => {
  const [jobId, setJobId] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Listen to all jobs for the technician dashboard
    // In a real app, we'd filter by technicianId, but for this demo we show all
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreJobs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Job[];
      
      // Merge with mock jobs for demo purposes
      // Filter out mock jobs that have the same ID as firestore jobs (if any)
      const mergedJobs = [...firestoreJobs, ...MOCK_JOBS.filter(mj => !firestoreJobs.find(fj => fj.id === mj.id))];
      
      setJobs(mergedJobs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const searchId = jobId.trim().toUpperCase();
    if (!searchId) return;

    setSearching(true);

    // Check current jobs state first
    const found = jobs.find(j => j.id === searchId || (searchId.startsWith('JOB-') ? j.id === searchId : j.id === `JOB-${searchId}`));
    if (found) {
      navigate(`/tech/job/${found.id}`);
      setSearching(false);
      return;
    }

    // Check Firestore directly if not in state
    try {
      const jobDoc = await getDoc(doc(db, 'jobs', searchId));
      if (jobDoc.exists()) {
        navigate(`/tech/job/${searchId}`);
      } else {
        setError('Job ID not found. Please check and try again.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `jobs/${searchId}`);
      setError('An error occurred while searching.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <PageLayout title="Technician Portal" activeTab="jobs">
      <div className="p-4 max-w-md mx-auto space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Hey, {user?.displayName?.split(' ')[0] || 'Mike'} 👋
            </h2>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {user?.displayName?.[0] || 'M'}
            </div>
          </div>
          
          <Card className="border-none shadow-xl shadow-blue-900/5 bg-gradient-to-br from-blue-600 to-blue-700 p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-blue-100 uppercase tracking-wider">Find Job by ID</label>
                {searching && <Clock className="animate-spin text-blue-200" size={14} />}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={jobId}
                    onChange={(e) => {
                      setJobId(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. 101 or JOB-101"
                    className={cn(
                      "w-full px-4 py-4 rounded-2xl border-none bg-white/10 text-white placeholder:text-blue-200 focus:ring-2 focus:ring-white/50 outline-none uppercase font-bold transition-all",
                      error && "ring-2 ring-red-400 bg-red-500/10"
                    )}
                  />
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-6 left-0 text-[10px] font-bold text-red-300 uppercase tracking-wider"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <button 
                  type="submit"
                  disabled={searching || !jobId.trim()}
                  className="bg-white text-blue-600 px-6 py-4 rounded-2xl font-extrabold hover:bg-blue-50 transition-all active:scale-95 shadow-lg shadow-black/10 disabled:opacity-50"
                >
                  {searching ? '...' : 'GO'}
                </button>
              </div>
            </form>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4">
          <Link to="/tech/availability" className="block">
            <Card className="p-5 border-none shadow-sm space-y-3 hover:bg-blue-50 transition-colors">
              <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule</p>
                <p className="text-sm font-black text-slate-800">Set Availability</p>
              </div>
            </Card>
          </Link>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-[0.2em]">Today's Schedule</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase">
              {jobs.length} Jobs
            </span>
          </div>
          <div className="space-y-4 pb-12">
            {loading ? (
              <div className="py-12 text-center text-slate-400 font-bold">Loading schedule...</div>
            ) : jobs.length > 0 ? (
              jobs.map(job => (
                <Link key={job.id} to={`/tech/job/${job.id}`}>
                  <Card className="hover:border-blue-200 transition-all cursor-pointer group active:scale-[0.98] border-none shadow-sm p-5">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-tighter">
                            {job.id}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock size={10} /> {job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-lg leading-tight">{job.customerName}</h4>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <MapPin size={12} className="text-blue-500" /> {job.address}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 font-bold">No jobs scheduled for today.</div>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

const JobChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [steps, setSteps] = useState<JobStepStatus[]>([]);
  const [suggestion, setSuggestion] = useState<string>('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (!id || !job || job.status !== 'in-progress') return;

    // Simulate technician movement
    // Real geolocation tracking
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateDoc(doc(db, 'jobs', id), {
          techLocation: {
            lat: latitude,
            lng: longitude,
            updatedAt: new Date().toISOString()
          }
        }).catch(err => console.error("Error updating location:", err));
      },
      (error) => {
        console.error("Error watching position:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [id, job?.status]);

  const initializedRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    // Reset state for new ID
    if (initializedRef.current !== id) {
      setSteps([]);
      setJob(null);
      initializingRef.current = false;
    }

    // Check mock first
    const foundJob = MOCK_JOBS.find(j => j.id === id);
    if (foundJob) {
      setJob(foundJob);
      setSteps(CHECKLIST_STEPS.map(s => ({ stepId: s.id, status: 'pending' })));
      initializedRef.current = id;
      return;
    }

    // Fetch from Firestore
    const unsubscribe = onSnapshot(doc(db, 'jobs', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Job;
        
        // Only update job if data changed to prevent unnecessary re-renders
        setJob(prev => {
          if (prev && JSON.stringify(prev) === JSON.stringify({ ...data, id: snapshot.id })) return prev;
          return { ...data, id: snapshot.id };
        });
        
        // Set start time if not already set and job is being viewed by tech
        if (!data.startTime && data.status !== 'completed' && !initializingRef.current) {
          initializingRef.current = true;
          updateDoc(doc(db, 'jobs', id), {
            startTime: new Date().toISOString(),
            status: 'in-progress'
          }).then(() => {
            sendNotification(
              data.customerId,
              "Technician is starting!",
              `Your technician has started working on your ${data.systemType} service.`,
              'info',
              id
            );
          }).catch(err => {
            console.error("Error setting start time:", err);
            initializingRef.current = false;
          });
        }

        // Initialize steps only once per job ID
        if (initializedRef.current !== id) {
          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps);
          } else {
            setSteps(CHECKLIST_STEPS.map(s => ({ stepId: s.id, status: 'pending' })));
          }
          initializedRef.current = id;
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `jobs/${id}`);
    });

    return () => unsubscribe();
  }, [id]);

  const updateStep = (stepId: string, status: 'pass' | 'fail') => {
    setSteps(prev => prev.map(s => s.stepId === stepId ? { ...s, status } : s));
  };

  const updateStepNotes = (stepId: string, notes: string) => {
    setSteps(prev => prev.map(s => s.stepId === stepId ? { ...s, notes } : s));
  };

  const handlePhotoUpload = (stepId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const base64 = readerEvent.target?.result as string;
          setSteps(prev => prev.map(s => s.stepId === stepId ? { ...s, photoUrl: base64 } : s));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleFinishJob = async () => {
    if (!id || !job) return;
    setIsFinishing(true);
    
    try {
      // If it's a real job (not in MOCK_JOBS), update Firestore
      if (!MOCK_JOBS.find(j => j.id === id)) {
        await updateDoc(doc(db, 'jobs', id), {
          status: 'completed',
          completedAt: new Date().toISOString(),
          steps: steps // Save the checklist steps
        });
        
        // Send notification to customer
        await sendNotification(
          job.customerId,
          "Service Completed!",
          `Your ${job.systemType} service is complete. You can now view the full report.`,
          'success',
          id
        );
      }
      navigate(`/tech/job/${id}/summary`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `jobs/${id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  const calculateRisk = () => {
    let risk = 0;
    
    CHECKLIST_STEPS.forEach(step => {
      const status = steps.find(s => s.stepId === step.id);
      
      if (!status || status.status === 'pending') {
        // Skipped step
        risk += step.isCritical ? 15 : 5;
      } else if (status.status === 'fail') {
        // Failed step
        risk += step.isCritical ? 25 : 10;
      }
    });

    return Math.min(Math.round(risk), 100);
  };

  const fetchSuggestion = async () => {
    setLoadingSuggestion(true);
    const text = await getSmartSuggestions(steps);
    setSuggestion(text);
    setLoadingSuggestion(false);
  };

  const riskScore = calculateRisk();

  const AVG_MINUTES_PER_STEP = 3;
  const totalSteps = CHECKLIST_STEPS.length;
  const completedSteps = steps.filter(s => s.status !== 'pending').length;
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100);
  const remainingSteps = totalSteps - completedSteps;
  const estimatedTimeRemaining = remainingSteps * AVG_MINUTES_PER_STEP;

  if (!job) return <PageLayout title="Loading..." showBack><div className="p-8 text-center"><Clock className="animate-spin mx-auto text-blue-600" /></div></PageLayout>;

  return (
    <PageLayout title={`Job: ${job.id}`} showBack activeTab="jobs">
      <div className="p-4 max-w-md mx-auto space-y-6 pb-32">
        {/* Customer Info */}
        <Card className="bg-blue-600 text-white border-none">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">{job.customerName}</h2>
              <p className="text-blue-100 text-sm">{job.systemType}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsChatOpen(true)}
                className="bg-white/20 p-2 rounded-lg hover:bg-white/30 transition-colors"
              >
                <MessageSquare size={20} />
              </button>
              <div className="bg-white/20 p-2 rounded-lg">
                <User size={20} />
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-blue-50"><MapPin size={14} /> {job.address}</p>
            <p className="flex items-center gap-2 text-blue-50"><Clock size={14} /> Started 15m ago</p>
          </div>
        </Card>

        {/* Customer Request / Job Notes */}
        {job.notes && job.notes.length > 0 && (
          <Card className="border-none shadow-sm bg-amber-50/50 border-l-4 border-l-amber-400 p-5">
            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <AlertTriangle size={14} />
              Customer Request & Job Notes
            </h3>
            <div className="space-y-3">
              {job.notes.map((note, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* AI Suggestions */}
        <Card className="border-l-4 border-l-purple-500 bg-purple-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
              <Sparkles size={16} />
              Smart Suggestions
            </div>
            <button 
              onClick={fetchSuggestion}
              disabled={loadingSuggestion}
              className="text-xs text-purple-600 font-semibold hover:underline"
            >
              {loadingSuggestion ? 'Thinking...' : 'Refresh'}
            </button>
          </div>
          <p className="text-sm text-slate-700 italic">
            {suggestion || "Complete a few checks to get AI-powered diagnostic tips."}
          </p>
        </Card>

        {/* Risk Meter */}
        <Card>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Callback Risk</span>
            <span className={cn(
              "text-lg font-black",
              riskScore > 50 ? "text-red-500" : riskScore > 20 ? "text-orange-500" : "text-green-500"
            )}>{riskScore}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${riskScore}%` }}
              className={cn(
                "h-full transition-colors duration-500",
                riskScore > 50 ? "bg-red-500" : riskScore > 20 ? "bg-orange-500" : "bg-green-500"
              )}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Risk increases if critical steps are skipped or issues are left unaddressed.</p>
        </Card>

        {/* Progress Indicator */}
        <Card className="border-none shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Job Progress</h3>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{progressPercentage}% <span className="text-sm font-bold text-slate-400">Complete</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Remaining</p>
              <p className="text-lg font-black text-blue-600 tracking-tight flex items-center justify-end gap-1.5">
                <Clock size={18} />
                {estimatedTimeRemaining} <span className="text-xs font-bold text-blue-400 uppercase">min</span>
              </p>
            </div>
          </div>
          
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              className="h-full bg-blue-600 rounded-full"
            />
          </div>
          
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            <span>{completedSteps} of {totalSteps} Steps</span>
            <span>{totalSteps - completedSteps} Remaining</span>
          </div>
        </Card>

        {/* Checklist */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="text-blue-600" size={20} />
            On-Site Checklist
          </h3>
          {CHECKLIST_STEPS.map((step) => {
            const status = steps.find(s => s.stepId === step.id);
            return (
              <div key={step.id}>
                <Card className={cn(
                  "transition-all",
                  status?.status === 'fail' && "border-red-100 bg-red-50/30"
                )}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 text-sm">{step.label}</h4>
                        {step.isCritical && (
                          <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">Critical</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                          onClick={() => updateStep(step.id, 'pass')}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-bold transition-all",
                            status?.status === 'pass' ? "bg-green-500 text-white shadow-sm" : "text-slate-400"
                          )}
                        >
                          YES
                        </button>
                        <button 
                          onClick={() => updateStep(step.id, 'fail')}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-bold transition-all",
                            status?.status === 'fail' ? "bg-red-500 text-white shadow-sm" : "text-slate-400"
                          )}
                        >
                          NO
                        </button>
                      </div>
                    </div>
                  </div>

                  {status?.status !== 'pending' && (
                    <div className={cn(
                      "mt-4 pt-4 border-t space-y-3",
                      status?.status === 'fail' ? "border-red-100" : "border-slate-100"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold",
                        status?.status === 'fail' ? "text-red-600" : "text-slate-500"
                      )}>
                        <MessageSquare size={14} />
                        {status?.status === 'fail' ? 'Issue Details / Required Notes' : 'Notes (Optional)'}
                      </div>
                      <textarea
                        value={status?.notes || ''}
                        onChange={(e) => updateStepNotes(step.id, e.target.value)}
                        placeholder={status?.status === 'fail' ? "Please describe the issue in detail..." : "Add any observations..."}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all min-h-[100px]",
                          status?.status === 'fail' 
                            ? "border-red-200 bg-white ring-2 ring-red-500/10 focus:ring-red-500" 
                            : "border-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-blue-500"
                        )}
                      />
                    </div>
                  )}

                  {status?.status === 'fail' && step.photoRequiredOnIssue && (
                    <div className="mt-4 pt-4 border-t border-red-100 space-y-3">
                      <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                        <AlertTriangle size={14} />
                        Photo Required for Issue
                      </div>
                      {status.photoUrl ? (
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-200">
                          <img src={status.photoUrl} alt="Issue" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => handlePhotoUpload(step.id)}
                            className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-lg"
                          >
                            <Camera size={16} className="text-blue-600" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handlePhotoUpload(step.id)}
                          className="w-full py-8 border-2 border-dashed border-red-200 rounded-xl flex flex-col items-center justify-center gap-2 text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Camera size={24} />
                          <span className="text-xs font-bold">Upload Photo</span>
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-3 max-w-md mx-auto z-40">
        <button 
          onClick={() => setShowUpdateModal(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
        >
          <MessageSquare size={20} />
          Update Client
        </button>
        <button 
          onClick={handleFinishJob}
          disabled={isFinishing}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors disabled:opacity-50"
        >
          {isFinishing ? (
            <Clock className="animate-spin" size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          Finish Job
        </button>
      </div>

      {/* Update Modal */}
      <AnimatePresence>
        {showUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpdateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-4">Send Update to {job.customerName}</h3>
              <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  "Hi {job.customerName}, I've finished the diagnostic. The issue is a <strong>failed capacitor</strong>. I'm replacing it now. ETA to completion: 30 mins."
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    alert('Update sent to customer!');
                    setShowUpdateModal(false);
                  }}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <Send size={18} />
                  Send Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <ChatModal 
            jobId={id!} 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            recipientName={job.customerName}
          />
        )}
      </AnimatePresence>
    </PageLayout>
  );
};

const JobSummary = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!id) return;
    
    // Check mock first
    const mock = MOCK_JOBS.find(j => j.id === id);
    if (mock) {
      setJob(mock);
      setLoading(false);
      return;
    }

    // Fetch from Firestore
    const fetchJobAndMessages = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'jobs', id));
        if (snapshot.exists()) {
          setJob({ ...snapshot.data(), id: snapshot.id } as Job);
        }

        // Fetch messages
        const messagesSnapshot = await getDocs(
          query(collection(db, 'jobs', id, 'messages'), orderBy('createdAt', 'asc'))
        );
        const msgs = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `jobs/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndMessages();
  }, [id]);

  const generateDetailedReport = () => {
    if (!job) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const reportHtml = `
        <html>
          <head>
            <title>HVAC Shield - Detailed Service Report - ${job.id}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
              body { 
                font-family: 'Inter', sans-serif; 
                padding: 40px; 
                line-height: 1.6; 
                color: #1e293b; 
                max-width: 800px; 
                margin: 0 auto;
              }
              .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                border-bottom: 4px solid #2563eb; 
                padding-bottom: 20px; 
                margin-bottom: 40px; 
              }
              .logo { font-weight: 900; font-size: 24px; color: #2563eb; text-transform: uppercase; letter-spacing: -1px; }
              .report-title { font-weight: 900; font-size: 32px; margin-bottom: 10px; }
              .section { margin-bottom: 40px; }
              .section-title { 
                font-weight: 900; 
                font-size: 14px; 
                text-transform: uppercase; 
                letter-spacing: 2px; 
                color: #64748b; 
                border-bottom: 1px solid #e2e8f0; 
                padding-bottom: 10px; 
                margin-bottom: 20px; 
              }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
              .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
              .value { font-weight: 700; font-size: 16px; }
              .checklist-item { 
                background: #f8fafc; 
                border-radius: 12px; 
                padding: 20px; 
                margin-bottom: 15px; 
                border-left: 4px solid #e2e8f0;
              }
              .checklist-item.pass { border-left-color: #10b981; }
              .checklist-item.fail { border-left-color: #ef4444; }
              .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
              .item-label { font-weight: 700; font-size: 14px; }
              .item-status { font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; }
              .status-pass { background: #d1fae5; color: #065f46; }
              .status-fail { background: #fee2e2; color: #991b1b; }
              .item-note { font-style: italic; font-size: 13px; color: #475569; margin-top: 10px; }
              .item-photo { margin-top: 15px; border-radius: 8px; overflow: hidden; max-width: 300px; border: 1px solid #e2e8f0; }
              .item-photo img { width: 100%; display: block; }
              .message { margin-bottom: 15px; padding: 12px; border-radius: 8px; background: #f1f5f9; }
              .message-meta { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
              .message-text { font-size: 13px; }
              .recommendation { 
                background: #eff6ff; 
                border: 1px solid #bfdbfe; 
                padding: 20px; 
                border-radius: 12px; 
                color: #1e40af; 
                font-weight: 500;
              }
              .footer { 
                margin-top: 60px; 
                text-align: center; 
                font-size: 12px; 
                color: #94a3b8; 
                border-top: 1px solid #e2e8f0; 
                padding-top: 20px; 
              }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">HVAC Shield</div>
              <div style="text-align: right">
                <div style="font-size: 12px; font-weight: 700">Service Report</div>
                <div style="font-size: 10px; color: #64748b">${new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div class="section">
              <h1 class="report-title">Service Summary</h1>
              <div class="grid">
                <div>
                  <div class="label">Job ID</div>
                  <div class="value">${job.id}</div>
                </div>
                <div>
                  <div class="label">Status</div>
                  <div class="value" style="color: #10b981">COMPLETED</div>
                </div>
                <div>
                  <div class="label">Customer</div>
                  <div class="value">${job.customerName}</div>
                </div>
                <div>
                  <div class="label">Technician</div>
                  <div class="value">${job.technicianName || 'Mike Miller'}</div>
                </div>
                <div style="grid-column: span 2">
                  <div class="label">Address</div>
                  <div class="value">${job.address}</div>
                </div>
                <div>
                  <div class="label">System Type</div>
                  <div class="value">${job.systemType}</div>
                </div>
                <div>
                  <div class="label">Completion Date</div>
                  <div class="value">${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Inspection Checklist</h2>
              ${job.steps?.map(s => {
                const step = CHECKLIST_STEPS.find(cs => cs.id === s.stepId);
                return `
                  <div class="checklist-item ${s.status}">
                    <div class="item-header">
                      <span class="item-label">${step?.label}</span>
                      <span class="item-status status-${s.status}">${s.status.toUpperCase()}</span>
                    </div>
                    ${s.notes ? `<div class="item-note">"${s.notes}"</div>` : ''}
                    ${s.photoUrl ? `
                      <div class="item-photo">
                        <img src="${s.photoUrl}" alt="Service detail" />
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            ${messages.length > 0 ? `
              <div class="section">
                <h2 class="section-title">Communication Log</h2>
                ${messages.map(m => `
                  <div class="message">
                    <div class="message-meta">${m.senderName} • ${m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString() : ''}</div>
                    <div class="message-text">${m.text}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="section">
              <h2 class="section-title">Technician Recommendations</h2>
              <div class="recommendation">
                ${job.notes && job.notes.length > 0 ? job.notes.join('<br>') : 'System is performing within manufacturer specifications. No immediate repairs required. Recommended annual maintenance in 12 months.'}
              </div>
            </div>

            <div class="footer">
              This report was generated by HVAC Shield. For questions regarding this service, please contact us at support@hvacshield.com.
            </div>

            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(reportHtml);
      printWindow.document.close();
    }
  };

  if (loading) return <PageLayout title="Loading" showBack><div className="p-8 text-center text-slate-400 font-bold">Loading summary...</div></PageLayout>;
  if (!job) return <PageLayout title="Error" showBack><div className="p-8 text-center text-red-500 font-bold">Job not found</div></PageLayout>;

  return (
    <PageLayout title="Job Summary" showBack activeTab="jobs">
      <div className="p-4 max-w-md mx-auto space-y-6 pb-24">
        <div className="text-center py-12">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-900/10"
          >
            <Check size={48} strokeWidth={3} />
          </motion.div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Job Completed!</h2>
          <p className="text-slate-500 font-medium mt-2">Detailed report sent to {job.customerName}</p>
        </div>

        <Card className="border-none shadow-sm p-6 space-y-6">
          <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] border-b border-slate-50 pb-3">Service Details</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Technician</p>
              <p className="font-extrabold text-slate-800">Mike Miller</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Duration</p>
              <p className="font-extrabold text-slate-800">
                {job.startTime && job.completedAt ? (
                  `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startTime).getTime()) / 60000)}m`
                ) : (
                  '1h 15m'
                )}
              </p>
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">System Type</p>
              <p className="font-extrabold text-slate-800">{job.systemType}</p>
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Service Address</p>
              <p className="font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin size={16} className="text-blue-500 shrink-0" />
                {job.address}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-none shadow-sm p-6">
          <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] border-b border-slate-50 pb-3 mb-4">Checks Performed</h3>
          <div className="space-y-6">
            {job.steps && job.steps.length > 0 ? (
              job.steps.map(stepStatus => {
                const step = CHECKLIST_STEPS.find(s => s.id === stepStatus.stepId);
                if (!step) return null;
                return (
                  <div key={stepStatus.stepId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-1.5 rounded-full",
                          stepStatus.status === 'pass' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          {stepStatus.status === 'pass' ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{step.label}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                        stepStatus.status === 'pass' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                      )}>
                        {stepStatus.status}
                      </span>
                    </div>
                    {stepStatus.notes && (
                      <div className="ml-10 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-600 italic leading-relaxed">"{stepStatus.notes}"</p>
                      </div>
                    )}
                    {stepStatus.photoUrl && (
                      <div className="ml-10 mt-2 rounded-xl overflow-hidden border border-slate-100 max-w-[200px]">
                        <img 
                          src={stepStatus.photoUrl} 
                          alt="Inspection detail" 
                          className="w-full h-auto object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-400 text-xs py-4">No checklist data available</p>
            )}
          </div>
        </Card>

        <div className="space-y-4 pt-4">
          <button 
            onClick={generateDetailedReport}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <Sparkles size={20} />
            Generate Detailed Report
          </button>

          <button 
            onClick={() => navigate('/tech')}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
          >
            Back to Dashboard
          </button>
          
          <Link 
            to={`/customer/job/${id}`}
            className="block text-center text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            View Customer Portal
          </Link>
        </div>
      </div>
    </PageLayout>
  );
};

const CustomerPortal = () => {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!id) return;
    
    // Check mock first for demo purposes
    const mock = MOCK_JOBS.find(j => j.id === id);
    if (mock) {
      setJob(mock);
      setLoading(false);
      return;
    }

    // Otherwise fetch from Firestore
    const unsubscribe = onSnapshot(doc(db, 'jobs', id), (snapshot) => {
      if (snapshot.exists()) {
        setJob({ ...snapshot.data(), id: snapshot.id } as Job);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `jobs/${id}`);
      setLoading(false);
    });

    // Fetch messages
    const fetchMessages = async () => {
      try {
        const messagesSnapshot = await getDocs(
          query(collection(db, 'jobs', id, 'messages'), orderBy('createdAt', 'asc'))
        );
        const msgs = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs);
      } catch (error) {
        // Silent fail for messages in portal
      }
    };
    fetchMessages();

    return () => unsubscribe();
  }, [id]);

  const generateDetailedReport = () => {
    if (!job) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const reportHtml = `
        <html>
          <head>
            <title>HVAC Shield - Service Report - ${job.id}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
              body { 
                font-family: 'Inter', sans-serif; 
                padding: 40px; 
                line-height: 1.6; 
                color: #1e293b; 
                max-width: 800px; 
                margin: 0 auto;
              }
              .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                border-bottom: 4px solid #2563eb; 
                padding-bottom: 20px; 
                margin-bottom: 40px; 
              }
              .logo { font-weight: 900; font-size: 24px; color: #2563eb; text-transform: uppercase; letter-spacing: -1px; }
              .report-title { font-weight: 900; font-size: 32px; margin-bottom: 10px; }
              .section { margin-bottom: 40px; }
              .section-title { 
                font-weight: 900; 
                font-size: 14px; 
                text-transform: uppercase; 
                letter-spacing: 2px; 
                color: #64748b; 
                border-bottom: 1px solid #e2e8f0; 
                padding-bottom: 10px; 
                margin-bottom: 20px; 
              }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
              .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
              .value { font-weight: 700; font-size: 16px; }
              .checklist-item { 
                background: #f8fafc; 
                border-radius: 12px; 
                padding: 20px; 
                margin-bottom: 15px; 
                border-left: 4px solid #e2e8f0;
              }
              .checklist-item.pass { border-left-color: #10b981; }
              .checklist-item.fail { border-left-color: #ef4444; }
              .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
              .item-label { font-weight: 700; font-size: 14px; }
              .item-status { font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; }
              .status-pass { background: #d1fae5; color: #065f46; }
              .status-fail { background: #fee2e2; color: #991b1b; }
              .item-note { font-style: italic; font-size: 13px; color: #475569; margin-top: 10px; }
              .item-photo { margin-top: 15px; border-radius: 8px; overflow: hidden; max-width: 300px; border: 1px solid #e2e8f0; }
              .item-photo img { width: 100%; display: block; }
              .message { margin-bottom: 15px; padding: 12px; border-radius: 8px; background: #f1f5f9; }
              .message-meta { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
              .message-text { font-size: 13px; }
              .recommendation { 
                background: #eff6ff; 
                border: 1px solid #bfdbfe; 
                padding: 20px; 
                border-radius: 12px; 
                color: #1e40af; 
                font-weight: 500;
              }
              .footer { 
                margin-top: 60px; 
                text-align: center; 
                font-size: 12px; 
                color: #94a3b8; 
                border-top: 1px solid #e2e8f0; 
                padding-top: 20px; 
              }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">HVAC Shield</div>
              <div style="text-align: right">
                <div style="font-size: 12px; font-weight: 700">Service Report</div>
                <div style="font-size: 10px; color: #64748b">${new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div class="section">
              <h1 class="report-title">Service Summary</h1>
              <div class="grid">
                <div>
                  <div class="label">Job ID</div>
                  <div class="value">${job.id}</div>
                </div>
                <div>
                  <div class="label">Status</div>
                  <div class="value" style="color: #10b981">COMPLETED</div>
                </div>
                <div>
                  <div class="label">Customer</div>
                  <div class="value">${job.customerName}</div>
                </div>
                <div>
                  <div class="label">Technician</div>
                  <div class="value">${job.technicianName || 'Mike Miller'}</div>
                </div>
                <div style="grid-column: span 2">
                  <div class="label">Address</div>
                  <div class="value">${job.address}</div>
                </div>
                <div>
                  <div class="label">System Type</div>
                  <div class="value">${job.systemType}</div>
                </div>
                <div>
                  <div class="label">Completion Date</div>
                  <div class="value">${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">Inspection Checklist</h2>
              ${job.steps?.map(s => {
                const step = CHECKLIST_STEPS.find(cs => cs.id === s.stepId);
                return `
                  <div class="checklist-item ${s.status}">
                    <div class="item-header">
                      <span class="item-label">${step?.label}</span>
                      <span class="item-status status-${s.status}">${s.status.toUpperCase()}</span>
                    </div>
                    ${s.notes ? `<div class="item-note">"${s.notes}"</div>` : ''}
                    ${s.photoUrl ? `
                      <div class="item-photo">
                        <img src="${s.photoUrl}" alt="Service detail" />
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>

            ${messages.length > 0 ? `
              <div class="section">
                <h2 class="section-title">Communication Log</h2>
                ${messages.map(m => `
                  <div class="message">
                    <div class="message-meta">${m.senderName} • ${m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString() : ''}</div>
                    <div class="message-text">${m.text}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <div class="section">
              <h2 class="section-title">Technician Recommendations</h2>
              <div class="recommendation">
                ${job.notes && job.notes.length > 0 ? job.notes.join('<br>') : 'System is performing within manufacturer specifications. No immediate repairs required. Recommended annual maintenance in 12 months.'}
              </div>
            </div>

            <div class="footer">
              This report was generated by HVAC Shield. For questions regarding this service, please contact us at support@hvacshield.com.
            </div>

            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(reportHtml);
      printWindow.document.close();
    }
  };

  if (loading) return <PageLayout title="Loading" showBack><div className="p-8 text-center text-slate-400 font-bold">Loading live updates...</div></PageLayout>;
  if (!job) return <PageLayout title="Error" showBack><div className="p-8 text-center text-red-500 font-bold">Job not found</div></PageLayout>;

  const timeline = [
    { time: job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM', event: 'Technician Dispatched', status: 'done' },
    { time: job.startTime ? new Date(job.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:15 AM', event: 'Technician Arrived', status: job.startTime ? 'done' : 'pending' },
    { time: job.startTime ? new Date(new Date(job.startTime).getTime() + 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:30 AM', event: 'Diagnostic Complete', status: job.steps?.some(s => s.status !== 'pending') ? 'done' : 'pending', note: job.steps?.some(s => s.status === 'fail') ? 'Issues identified during inspection.' : 'All checks passed.' },
    { time: job.startTime ? new Date(new Date(job.startTime).getTime() + 30 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:45 AM', event: 'Repair in Progress', status: job.status === 'in-progress' ? 'current' : job.status === 'completed' ? 'done' : 'pending' },
    { time: job.completedAt ? new Date(job.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '11:15 AM', event: 'Final Testing & Completion', status: job.status === 'completed' ? 'done' : 'pending' },
  ];

  return (
    <PageLayout title="Live Update" showBack transparentHeader activeTab="home">
      <div className="bg-slate-900 text-white p-8 pb-16 pt-24">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Shield className="text-blue-400" size={24} />
              </div>
              <span className="font-black text-xl tracking-tight">HVAC Shield</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              Live
            </div>
          </div>
          <h1 className="text-4xl font-black mb-3 tracking-tight">Hi {job.customerName.split(' ')[0]},</h1>
          <p className="text-slate-400 font-medium">
            {job.status === 'completed' 
              ? `Your ${job.systemType} service is complete!` 
              : `We're getting your ${job.systemType} back in shape.`}
          </p>
          
          {/* Live Status Banner / Completed Banner */}
          {job.status === 'completed' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 bg-emerald-500 rounded-3xl p-6 flex items-center gap-5 shadow-xl shadow-emerald-900/40 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle2 size={120} />
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                <Check size={32} className="text-white" strokeWidth={3} />
              </div>
              <div className="relative z-10">
                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1">Service Complete</p>
                <p className="text-lg font-black text-white leading-tight">Everything is running perfectly.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Activity className="text-white animate-pulse" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Current Status</p>
                <p className="text-sm font-black text-white">{timeline.find(t => t.status === 'current')?.event || 'Job Scheduled'}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-10 pb-24">
        {job.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-white border-none shadow-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h3 className="font-black text-slate-800 text-lg">Service Report</h3>
                <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Verified</span>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Completed At</p>
                  <p className="font-extrabold text-slate-800 text-sm">
                    {job.completedAt ? new Date(job.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '11:30 AM'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">System Health</p>
                  <p className="font-extrabold text-emerald-600 text-sm flex items-center gap-1">
                    <CheckCircle2 size={14} /> 100% Optimized
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Technician's Final Note</p>
                <p className="text-sm text-slate-700 font-medium leading-relaxed italic">
                  "System is back to peak performance. Replaced the faulty capacitor and performed a full pressure test. All readings are within manufacturer specifications."
                </p>
              </div>

              <button 
                onClick={generateDetailedReport}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <History size={20} />
                Download PDF Receipt
              </button>

              {job.steps && job.steps.length > 0 && (
                <div className="pt-6 border-t border-slate-50 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed Inspection Report</h4>
                  <div className="space-y-4">
                    {job.steps.map(stepStatus => {
                      const step = CHECKLIST_STEPS.find(s => s.id === stepStatus.stepId);
                      if (!step) return null;
                      return (
                        <div key={stepStatus.stepId} className="flex items-start gap-4">
                          <div className={cn(
                            "mt-0.5 p-1 rounded-full shrink-0",
                            stepStatus.status === 'pass' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            {stepStatus.status === 'pass' ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{step.label}</p>
                            {stepStatus.notes && (
                              <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">"{stepStatus.notes}"</p>
                            )}
                            {stepStatus.photoUrl && (
                              <div className="mt-2 rounded-lg overflow-hidden border border-slate-50 max-w-[120px]">
                                <img 
                                  src={stepStatus.photoUrl} 
                                  alt="Service detail" 
                                  className="w-full h-auto object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        <Card className="mb-6 shadow-xl border-none p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h3 className="font-black text-slate-800 text-lg">Job Details</h3>
            <span className={cn(
              "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
              job.status === 'completed' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
            )}>
              {job.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">System Type</p>
              <p className="font-extrabold text-slate-800 text-sm">{job.systemType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Scheduled For</p>
              <p className="font-extrabold text-slate-800 text-sm">
                {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Service Address</p>
            <p className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              {job.address}
            </p>
          </div>
        </Card>

        <Card className="mb-10 shadow-2xl shadow-black/10 border-none p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-100 rounded-[24px] flex items-center justify-center text-blue-600 overflow-hidden shadow-inner">
              <img src={job.technicianPhotoUrl || "https://picsum.photos/seed/tech/200/200"} alt="Tech" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-slate-800 text-lg tracking-tight">{job.technicianName || 'Assigning...'}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{job.technicianBio || 'HVAC Professional'}</p>
            </div>
            <button 
              onClick={() => setIsChatOpen(true)}
              className="bg-slate-100 p-4 rounded-2xl text-slate-600 active:scale-90 transition-transform hover:bg-slate-200"
            >
              <MessageSquare size={24} />
            </button>
          </div>
        </Card>

        <div className="relative">
          {/* Progress Header */}
          <div className="flex items-center justify-between mb-8 px-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Progress</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {Math.round((timeline.filter(t => t.status === 'done').length / timeline.length) * 100)}% Complete
              </h3>
            </div>
            <div className="w-14 h-14 rounded-full border-4 border-slate-100 flex items-center justify-center relative">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-blue-500"
                  strokeDasharray={`${(timeline.filter(t => t.status === 'done').length / timeline.length) * 150.8} 150.8`}
                  style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-600">
                {timeline.filter(t => t.status === 'done').length}/{timeline.length}
              </span>
            </div>
          </div>

          {/* Animated Progress Line Background */}
          <div className="absolute left-[15px] top-20 bottom-2 w-1 bg-slate-100 rounded-full" />
          
          {/* Animated Progress Line Foreground */}
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${(timeline.filter(t => t.status === 'done').length / (timeline.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute left-[15px] top-20 w-1 bg-blue-500 rounded-full z-0"
          >
            {/* Glowing Tip */}
            <motion.div 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full blur-sm"
            />
          </motion.div>

          <div className="space-y-12 relative z-10 pt-4">
            {timeline.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="flex gap-8 relative"
              >
                <div className="relative flex flex-col items-center">
                  <motion.div 
                    initial={item.status === 'current' ? { scale: 0.8 } : {}}
                    animate={item.status === 'current' ? { scale: [1, 1.2, 1] } : {}}
                    transition={item.status === 'current' ? { repeat: Infinity, duration: 2 } : {}}
                    className={cn(
                      "w-8 h-8 rounded-full border-4 border-white z-10 flex items-center justify-center shadow-md transition-colors duration-500",
                      item.status === 'done' ? "bg-blue-500" : item.status === 'current' ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)]" : "bg-slate-200"
                    )}
                  >
                    {item.status === 'done' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check size={16} className="text-white" strokeWidth={4} />
                      </motion.div>
                    )}
                    {item.status === 'current' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </motion.div>
                </div>

                <div className={cn(
                  "flex-1 pt-0.5 transition-all duration-500",
                  item.status === 'pending' ? "opacity-40" : "opacity-100"
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className={cn(
                        "font-black text-lg tracking-tight mb-0.5",
                        item.status === 'pending' ? "text-slate-400" : "text-slate-800"
                      )}>
                        {item.event}
                      </h5>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.time}</span>
                        {item.status === 'current' && (
                          <span className="bg-blue-100 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.note && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.2 + 0.3 }}
                      className="mt-3 bg-blue-50/80 backdrop-blur-sm p-4 rounded-2xl border border-blue-100/50 shadow-sm"
                    >
                      <p className="text-sm text-blue-900 font-semibold leading-relaxed italic flex gap-2">
                        <MessageSquare size={14} className="text-blue-400 shrink-0 mt-0.5" />
                        "{item.note}"
                      </p>
                    </motion.div>
                  )}

                  {item.status === 'current' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-5 rounded-[32px] overflow-hidden aspect-video bg-slate-100 shadow-xl shadow-blue-900/5 border-4 border-white"
                    >
                      <img src="https://picsum.photos/seed/hvac-repair/800/600" alt="Repair" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-4">
                        <p className="text-white text-[10px] font-bold uppercase tracking-widest">Live Photo from {job.technicianName?.split(' ')[0] || 'Technician'}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16 p-8 bg-slate-50 rounded-[32px] border border-slate-100 text-center space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-500">Need to reschedule or have questions?</p>
            <button className="w-full bg-white text-slate-800 py-4 rounded-2xl font-black shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Phone size={20} className="text-blue-600" />
              Call Support
            </button>
          </div>
          
          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm font-bold text-slate-500 mb-4">Keep your system running peak performance</p>
            <button 
              onClick={() => setShowBookingModal(true)}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Calendar size={20} />
              Schedule Annual Tune-up
            </button>
          </div>
        </div>
      </div>

      {/* Booking Success Notification */}
      <AnimatePresence>
        {bookingSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-50"
          >
            <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm tracking-tight">Booking Confirmed!</p>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">We'll see you soon.</p>
              </div>
              <button onClick={() => setBookingSuccess(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <ChatModal 
            jobId={id!} 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            recipientName={job.technicianName || "Technician"}
          />
        )}
      </AnimatePresence>

      <BookTuneUpModal 
        isOpen={showBookingModal} 
        onClose={() => setShowBookingModal(false)}
        onBooked={() => {
          setBookingSuccess(true);
          setTimeout(() => setBookingSuccess(false), 5000);
        }}
        prefill={{
          customerId: job.customerId,
          customerName: job.customerName,
          address: job.address
        }}
      />
    </PageLayout>
  );
};

const MainContent = () => {
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    console.log("App: Global state check", { 
      authStatus: user ? "Authenticated" : "Unauthenticated",
      email: user?.email,
      role: userRole,
      loading: loading
    });
  }, [user, userRole, loading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<Navigate to="/login" />} />
        
        <Route path="/tech" element={
          <ProtectedRoute role="technician">
            <TechDashboard />
          </ProtectedRoute>
        } />
        <Route path="/tech/availability" element={
          <ProtectedRoute role="technician">
            <AvailabilitySettings />
          </ProtectedRoute>
        } />
        <Route path="/tech/job/:id" element={
          <ProtectedRoute role="technician">
            <JobChecklist />
          </ProtectedRoute>
        } />
        <Route path="/tech/job/:id/summary" element={
          <ProtectedRoute role="technician">
            <JobSummary />
          </ProtectedRoute>
        } />
        
        <Route path="/customer-home" element={
          <ProtectedRoute role="customer">
            <CustomerHome />
          </ProtectedRoute>
        } />
        
        <Route path="/customer/job/:id" element={<CustomerPortal />} />
        <Route path="/customer/history/:id" element={<CustomerPortal />} />
      </Routes>
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
