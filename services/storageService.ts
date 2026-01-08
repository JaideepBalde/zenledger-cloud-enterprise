
import { User, Transaction, UserRole, ServiceResponse, Session, MoneyRequest, RequestStatus, TransactionType, TransactionCategory, FamilyMessage } from '../types';

const USERS_KEY = 'zenledger_v16_users';
const TRANSACTIONS_KEY = 'zenledger_v16_transactions';
const REQUESTS_KEY = 'zenledger_v16_requests';
const MESSAGES_KEY = 'zenledger_v16_messages';
const SESSION_KEY = 'zenledger_v16_session';

// Hosting Configuration
export const ENTERPRISE_CONFIG = {
  // Use environment variables for production readiness
  API_BASE_URL: (typeof process !== 'undefined' && process.env.VITE_API_URL) || '', 
  USE_CLOUD: (typeof process !== 'undefined' && process.env.VITE_USE_CLOUD === 'true'),
  MONGO_URI: (typeof process !== 'undefined' && process.env.MONGO_URI) || "mongodb+srv://jaydeep:jaydeep123@jaydeep.ezjfkgl.mongodb.net/?appName=jaydeep",
  JWT_SECRET: (typeof process !== 'undefined' && process.env.JWT_SECRET) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
};

const SESSION_DURATION = 86400000;

// Internal Helper for API calls
const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<ServiceResponse<T>> => {
  if (!ENTERPRISE_CONFIG.USE_CLOUD) return { success: false, error: 'Cloud mode disabled.' };
  
  const session = storageService.getStoredSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { 'Authorization': `Bearer ${session.token}` } : {}),
    ...((options.headers as any) || {})
  };

  try {
    const response = await fetch(`${ENTERPRISE_CONFIG.API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Network error.' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'Connection failed.' };
  }
};

export const storageService = {
  // Methods made Async for Hosting Readiness
  getUsers: async (): Promise<User[]> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      const res = await apiRequest<User[]>('/users');
      if (res.success) return res.data!;
    }
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  },

  getTransactions: async (): Promise<Transaction[]> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      const res = await apiRequest<Transaction[]>('/transactions');
      if (res.success) return res.data!;
    }
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  },

  getRequests: async (): Promise<MoneyRequest[]> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      const res = await apiRequest<MoneyRequest[]>('/requests');
      if (res.success) return res.data!;
    }
    return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
  },

  getMessages: async (session?: Session): Promise<FamilyMessage[]> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      const res = await apiRequest<FamilyMessage[]>('/messages');
      if (res.success) return res.data!;
    }
    const all = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    if (!session) return all;
    const familyMsgs = all.filter((m: FamilyMessage) => m.familyId === session.familyId);
    if (session.role === UserRole.PARENT) return familyMsgs;
    return familyMsgs.filter((m: FamilyMessage) => m.fromId === session.userId || m.toId === session.userId);
  },

  signupFamily: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<User>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<User>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ familyId, handle, password: pass })
      });
    }

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const fid = familyId.trim().toLowerCase().replace(/\s+/g, '_');
    const username = handle.trim().toLowerCase();
    
    if (users.find((u: any) => u.familyId === fid && u.username === username)) {
      return { success: false, error: 'Identity already exists.' };
    }

    const newUser: User = {
      id: `u_${Math.random().toString(36).substr(2, 9)}`,
      familyId: fid, name: handle, username, password: pass,
      role: UserRole.PARENT, isActive: true
    };
    
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
    return { success: true, data: newUser };
  },

  login: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<Session>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      const res = await apiRequest<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ familyId, handle, password: pass })
      });
      if (res.success) localStorage.setItem(SESSION_KEY, JSON.stringify(res.data));
      return res;
    }

    const fid = familyId.trim().toLowerCase();
    const username = handle.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: any) => u.familyId === fid && u.username === username && u.password === pass);

    if (!user) return { success: false, error: 'Invalid credentials.' };

    const session: Session = {
      token: ENTERPRISE_CONFIG.JWT_SECRET,
      userId: user.id, familyId: user.familyId, role: user.role,
      exp: Date.now() + SESSION_DURATION, cloudSync: false
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, data: session };
  },

  createChild: async (session: Session, username: string, pass: string): Promise<ServiceResponse<User>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<User>('/users/child', {
        method: 'POST',
        body: JSON.stringify({ username, password: pass })
      });
    }

    if (session.role !== UserRole.PARENT) return { success: false, error: 'Unauthorized.' };
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const handle = username.trim().toLowerCase();
    if (users.find((u: any) => u.familyId === session.familyId && u.username === handle)) {
      return { success: false, error: 'Handle already provisioned.' };
    }
    const newChild: User = {
      id: `u_${Math.random().toString(36).substr(2, 9)}`,
      familyId: session.familyId, name: handle, username: handle, password: pass,
      role: UserRole.CHILD, parentId: session.userId, isActive: true
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newChild]));
    return { success: true, data: newChild };
  },

  saveTransaction: async (session: Session, tx: Transaction): Promise<ServiceResponse<Transaction>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify(tx)
      });
    }
    const txs = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([tx, ...txs]));
    return { success: true, data: tx };
  },

  sendMessage: async (session: Session, toId: string, text: string, replyToId?: string): Promise<ServiceResponse<FamilyMessage>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<FamilyMessage>('/messages', {
        method: 'POST',
        body: JSON.stringify({ toId, text, replyToId })
      });
    }

    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const newMessage: FamilyMessage = {
      id: `msg_${Date.now()}`,
      familyId: session.familyId,
      fromId: session.userId,
      fromRole: session.role,
      toId,
      text: text.trim(),
      timestamp: Date.now(),
      isRead: false
    };
    localStorage.setItem(MESSAGES_KEY, JSON.stringify([newMessage, ...messages]));
    return { success: true, data: newMessage };
  },

  markMessageRead: async (messageId: string): Promise<ServiceResponse<boolean>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<boolean>(`/messages/${messageId}/read`, { method: 'PATCH' });
    }
    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const idx = messages.findIndex((m: FamilyMessage) => m.id === messageId);
    if (idx !== -1) {
      messages[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
    return { success: true, data: true };
  },

  createRequest: async (session: Session, amount: number, reason: string): Promise<ServiceResponse<MoneyRequest>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<MoneyRequest>('/requests', {
        method: 'POST',
        body: JSON.stringify({ amount, reason })
      });
    }
    const requests = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
    const newRequest: MoneyRequest = {
      id: `req_${Date.now()}`, childId: session.userId, amount, reason, status: RequestStatus.PENDING, timestamp: Date.now()
    };
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([newRequest, ...requests]));
    return { success: true, data: newRequest };
  },

  updateRequestStatus: async (session: Session, requestId: string, status: RequestStatus): Promise<ServiceResponse<boolean>> => {
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      return apiRequest<boolean>(`/requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    }
    const requests = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
    const idx = requests.findIndex((r: any) => r.id === requestId);
    if (idx !== -1) {
      requests[idx].status = status;
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    }
    return { success: true, data: true };
  },

  getStoredSession: (): Session | null => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() > session.exp) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  },

  logout: () => localStorage.removeItem(SESSION_KEY),

  clearAll: async (session: Session) => {
    if (session.role !== UserRole.PARENT) return;
    if (ENTERPRISE_CONFIG.USE_CLOUD) {
      await apiRequest('/system/reset', { method: 'DELETE' });
    }
    localStorage.clear();
  },

  getOnboardingStatus: (userId: string): boolean => localStorage.getItem(`onboarded_${userId}`) === 'true',
  setOnboardingStatus: (userId: string) => localStorage.setItem(`onboarded_${userId}`, 'true'),

  // Finance-grade export — parent-only access
  downloadChildLedgerCSV: async (session: Session, childId: string) => {
    if (session.role !== UserRole.PARENT) throw new Error("Unauthorized.");
    const users = await storageService.getUsers();
    const child = users.find(u => u.id === childId);
    if (!child) throw new Error("Child not found.");

    const txs = (await storageService.getTransactions())
      .filter(t => t.userId === childId)
      .sort((a, b) => a.timestamp - b.timestamp);

    const headers = ["Date", "Type", "Amount (INR)", "Description", "Initiated By", "Initiated Role", "Approved By", "Reference Request ID"];
    const rows = txs.map(t => [
      new Date(t.timestamp).toLocaleString(),
      t.type,
      t.amount.toFixed(2),
      `"${t.description.replace(/"/g, '""')}"`,
      t.type === TransactionType.CREDIT ? "Parent" : child.name,
      t.type === TransactionType.CREDIT ? UserRole.PARENT : UserRole.CHILD,
      t.description.toLowerCase().startsWith('approved:') ? "Parent" : "-",
      t.id.includes('tx_app') || t.id.includes('tx_req') ? t.id : "-"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `ledger_${child.username}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  downloadMonthlySummaryCSV: async (session: Session, childId: string) => {
    if (session.role !== UserRole.PARENT) throw new Error("Unauthorized.");
    const users = await storageService.getUsers();
    const child = users.find(u => u.id === childId);
    if (!child) throw new Error("Child not found.");

    const txs = (await storageService.getTransactions()).filter(t => t.userId === childId);
    const monthlyData: Record<string, { credits: number, debits: number }> = {};
    txs.forEach(t => {
      const monthKey = new Date(t.timestamp).toISOString().substring(0, 7);
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { credits: 0, debits: 0 };
      if (t.type === TransactionType.CREDIT) monthlyData[monthKey].credits += t.amount;
      else monthlyData[monthKey].debits += t.amount;
    });

    const headers = ["Month", "Total Credits (INR)", "Total Debits (INR)", "Net Change (INR)"];
    const rows = Object.keys(monthlyData).sort().map(m => {
      const { credits, debits } = monthlyData[m];
      return [m, credits.toFixed(2), debits.toFixed(2), (credits - debits).toFixed(2)];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `summary_${child.username}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
