
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User, UserRole, Transaction, TransactionType, Session,
  TransactionCategory, MoneyRequest, RequestStatus, FamilyMessage
} from '../types';
import { storageService } from '../services/storageService';
import { Onboarding } from './components/Onboarding';
import { HelpSection } from './components/HelpSection';
import { GoogleGenAI } from "@google/genai";

// --- PREMIUM DESIGN TOKENS ---
const BRAND_OWNER = "Jaydeep Balde";
const NEUTRAL_BG = "bg-[#F8FAFC]"; // Calm slate-50
const CARD_STYLE = "bg-white border border-slate-200/60 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden backdrop-blur-sm";
const INPUT_STYLE = "w-full bg-slate-50/50 border border-slate-200/80 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600/30 transition-all duration-300 placeholder:text-slate-400 font-medium";
const BUTTON_PRIMARY = "bg-slate-900 hover:bg-indigo-950 text-white font-bold py-5 px-8 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-2xl shadow-slate-900/10 uppercase text-[10px] tracking-[0.3em]";

// --- UTILS ---
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const relTime = (t: number) => {
  const d = Date.now() - t;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(t).toLocaleDateString();
};

// --- COMPONENTS ---

const MindfulnessTrigger = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Stop audio when component unmounts or session changes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/Gayatri Mantra - Om Bhur Bhuva Swaha.mp3');
      audioRef.current.volume = 0.3;
      audioRef.current.loop = true;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPulsing(false);
    } else {
      audioRef.current.play().catch(e => console.warn("Audio interaction required."));
      setIsPlaying(true);
      setPulsing(true);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <button
        onClick={togglePlay}
        className={`group relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-50 border-2 border-orange-200/50 shadow-lg transition-all duration-700 hover:scale-110 active:scale-95 outline-none ${isPlaying ? 'ring-4 ring-orange-300/30' : ''}`}
      >
        {pulsing && (
          <div className="absolute inset-0 rounded-full border-2 border-orange-400 animate-ping opacity-40"></div>
        )}
        <div className="relative z-10">
          {isPlaying ? (
            // Pause symbol
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-600 transition-colors duration-300">
              <path d="M6 4h4v16H6V4zM14 4h4v16h-4V4z"/>
            </svg>
          ) : (
            // Om symbol
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-500 group-hover:text-orange-700 transition-colors duration-300">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          )}
        </div>
      </button>
    </div>
  );
};

// Dashboard components remain consistent for functional readiness
const TransactionRow: React.FC<{ tx: Transaction }> = ({ tx }) => (
  <div className="flex items-center justify-between py-5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors px-2">
    <div className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
        tx.type === TransactionType.CREDIT ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}>
        <span className="text-lg font-bold">{tx.type === TransactionType.CREDIT ? '↓' : '↑'}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{tx.description}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{relTime(tx.timestamp)} • {tx.category}</p>
      </div>
    </div>
    <div className={`text-sm font-bold tabular-nums ${
      tx.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-slate-900'
    }`}>
      {tx.type === TransactionType.CREDIT ? '+' : '-'}{fmt(tx.amount)}
    </div>
  </div>
);

const MessageThread: React.FC<{
  messages: FamilyMessage[];
  users: User[];
  currentUserId: string;
  targetId: string;
  onSend: (text: string) => void;
}> = ({ messages, users, currentUserId, targetId, onSend }) => {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const filteredMessages = messages
    .filter(m => (m.fromId === targetId && m.toId === currentUserId) || (m.fromId === currentUserId && m.toId === targetId))
    .sort((a, b) => a.timestamp - b.timestamp);

  const targetUser = users.find(u => u.id === targetId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          SECURE CHANNEL: {targetUser?.name || 'NODE'}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
        {filteredMessages.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-400 text-[10px] uppercase tracking-widest italic">
            No active logs.
          </div>
        )}
        {filteredMessages.map(m => (
          <div key={m.id} className={`flex ${m.fromId === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
              m.fromId === currentUserId 
              ? 'bg-slate-900 text-white rounded-br-none shadow-sm' 
              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
            }`}>
              {m.text}
              <div className={`text-[9px] mt-2 opacity-60 text-right font-medium`}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-5 border-t border-slate-100 bg-white">
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="Log message..." 
            value={text} 
            onChange={e => setText(e.target.value)} 
            className={INPUT_STYLE}
          />
          <button type="submit" className={BUTTON_PRIMARY + " !py-2"}>Send</button>
        </div>
      </form>
    </div>
  );
};

// Dashboards stay optimized for logic flow
const ParentDashboard: React.FC<{
  session: Session;
  users: User[];
  transactions: Transaction[];
  requests: MoneyRequest[];
  messages: FamilyMessage[];
  sync: () => Promise<void>;
  onLogout: () => void;
}> = ({ session, users, transactions, requests, messages, sync, onLogout }) => {
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [allocAmount, setAllocAmount] = useState('');
  const [newChildHandle, setNewChildHandle] = useState('');
  const [newChildPass, setNewChildPass] = useState('');

  const children = users.filter(u => u.role === UserRole.CHILD && u.familyId === session.familyId);
  const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING);
  
  const familyTotalBalance = useMemo(() => {
    return children.reduce((sum, child) => {
      const childTxs = transactions.filter(t => t.userId === child.id);
      return sum + childTxs.reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
    }, 0);
  }, [children, transactions]);

  const handleAllocate = async () => {
    const val = parseFloat(allocAmount);
    if (!val || !selectedChildId) return;
    const res = await storageService.saveTransaction(session, {
      id: `tx_${Date.now()}`,
      userId: selectedChildId,
      amount: val,
      type: TransactionType.CREDIT,
      category: TransactionCategory.ALLOWANCE,
      description: "Parent Fund Allocation",
      timestamp: Date.now()
    });
    if (res.success) { setAllocAmount(''); await sync(); }
  };

  const handleRequestAction = async (requestId: string, status: RequestStatus) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;
    const res = await storageService.updateRequestStatus(session, requestId, status);
    if (res.success && status === RequestStatus.APPROVED) {
      await storageService.saveTransaction(session, {
        id: `tx_req_${Date.now()}`,
        userId: req.childId,
        amount: req.amount,
        type: TransactionType.CREDIT,
        category: TransactionCategory.ALLOWANCE,
        description: `Approved: ${req.reason}`,
        timestamp: Date.now()
      });
    }
    await sync();
  };

  const handleCreateChild = async () => {
    if (!newChildHandle || !newChildPass) return;
    const res = await storageService.createChild(session, newChildHandle, newChildPass);
    if (res.success) { setNewChildHandle(''); setNewChildPass(''); await sync(); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className={`${CARD_STYLE} p-8 bg-slate-900 text-white border-0 shadow-2xl`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Aggregate Assets</p>
          <h2 className="text-4xl font-black tracking-tight tabular-nums">{fmt(familyTotalBalance)}</h2>
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Core Online
          </div>
        </div>
        <div className={`${CARD_STYLE} p-8`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Member Nodes</p>
          <h2 className="text-4xl font-black tracking-tight tabular-nums">{children.length}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Verified Identities</p>
        </div>
        <div className={`${CARD_STYLE} p-8`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Pending Requests</p>
          <h2 className={`text-4xl font-black tracking-tight tabular-nums ${pendingRequests.length > 0 ? 'text-amber-500' : 'text-slate-900'}`}>{pendingRequests.length}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Requiring Auth</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {pendingRequests.length > 0 && (
            <div className={CARD_STYLE}>
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Authorization Queue</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {pendingRequests.map(r => {
                  const child = users.find(u => u.id === r.childId);
                  return (
                    <div key={r.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{child?.name} requests {fmt(r.amount)}</p>
                        <p className="text-xs text-slate-500 mt-2 italic">"{r.reason}"</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleRequestAction(r.id, RequestStatus.APPROVED)} className="bg-slate-900 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all">Authorize</button>
                        <button onClick={() => handleRequestAction(r.id, RequestStatus.REJECTED)} className="bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-10">
             <div className={CARD_STYLE}>
                <div className="px-8 py-5 border-b border-slate-100">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Infrastructure Nodes</h3>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 font-bold text-[9px] uppercase tracking-[0.2em] border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-4">Node Handle</th>
                          <th className="px-8 py-4">Derived Balance</th>
                          <th className="px-8 py-4">Management</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {children.map(c => {
                          const bal = transactions.filter(t => t.userId === c.id).reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-8 py-5 font-bold text-slate-900">@{c.username}</td>
                              <td className="px-8 py-5 font-black tabular-nums text-slate-700">{fmt(bal)}</td>
                              <td className="px-8 py-5">
                                <button onClick={() => setSelectedChildId(c.id)} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline">Verify Details</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                   </table>
                </div>
             </div>

             {selectedChildId && (
               <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className={CARD_STYLE}>
                      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                         <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Capital Injection</h3>
                         <button onClick={() => setSelectedChildId('')} className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500">Close</button>
                      </div>
                      <div className="p-8 space-y-5">
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Target Identity</p>
                           <p className="text-sm font-black text-slate-900">@{children.find(c => c.id === selectedChildId)?.username}</p>
                         </div>
                         <input type="number" placeholder="Value (₹)" value={allocAmount} onChange={e => setAllocAmount(e.target.value)} className={INPUT_STYLE} />
                         <button onClick={handleAllocate} className={`${BUTTON_PRIMARY} w-full`}>Authorize Transfer</button>
                      </div>
                    </div>
                    <div className={CARD_STYLE}>
                      <MessageThread 
                        messages={messages} 
                        users={users} 
                        currentUserId={session.userId} 
                        targetId={selectedChildId} 
                        onSend={async (txt) => { await storageService.sendMessage(session, selectedChildId, txt); await sync(); }}
                      />
                    </div>
                 </div>

                 <div className={CARD_STYLE}>
                   <div className="px-8 py-5 border-b border-slate-100">
                     <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Data Portability</h3>
                   </div>
                   <div className="p-8 flex flex-col sm:flex-row gap-6 items-center justify-between">
                     <div className="text-[11px] font-medium text-slate-500 max-w-sm">
                       <p className="font-black text-slate-900 uppercase tracking-widest mb-1">Export Ledger Records</p>
                       <p className="leading-relaxed">Generate standardized CSV summaries for the identity <span className="text-indigo-600 font-bold">@{children.find(c => c.id === selectedChildId)?.username}</span>.</p>
                     </div>
                     <div className="flex gap-4">
                       <button 
                         onClick={() => storageService.downloadChildLedgerCSV(session, selectedChildId)}
                         className="px-6 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                       >
                         Full Ledger
                       </button>
                       <button 
                         onClick={() => storageService.downloadMonthlySummaryCSV(session, selectedChildId)}
                         className="px-6 py-3 bg-white border border-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                       >
                         Monthly Pulse
                       </button>
                     </div>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <div className={CARD_STYLE}>
              <div className="px-8 py-5 border-b border-slate-100">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Identity Provisioning</h3>
              </div>
              <div className="p-8 space-y-5">
                <input type="text" placeholder="Identity Handle" value={newChildHandle} onChange={e => setNewChildHandle(e.target.value)} className={INPUT_STYLE} />
                <input type="password" placeholder="Passphrase" value={newChildPass} onChange={e => setNewChildPass(e.target.value)} className={INPUT_STYLE} />
                <button onClick={handleCreateChild} className={`${BUTTON_PRIMARY} w-full`}>Establish Node</button>
              </div>
           </div>

           <HelpSection />
        </div>
      </div>
    </div>
  );
};

const ChildDashboard: React.FC<{
  session: Session;
  user: User;
  transactions: Transaction[];
  requests: MoneyRequest[];
  messages: FamilyMessage[];
  users: User[];
  sync: () => Promise<void>;
}> = ({ session, user, transactions, requests, messages, users, sync }) => {
  const [spendAmount, setSpendAmount] = useState('');
  const [spendDesc, setSpendDesc] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');

  const myTxs = useMemo(() => transactions.filter(t => t.userId === user.id), [transactions, user.id]);
  const balance = useMemo(() => myTxs.reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0), [myTxs]);
  const parent = users.find(u => u.familyId === session.familyId && u.role === UserRole.PARENT);

  const handleSpend = async () => {
    const val = parseFloat(spendAmount);
    if (!val || val <= 0 || !spendDesc) return;
    if (val > balance) return;
    const res = await storageService.saveTransaction(session, {
      id: `tx_${Date.now()}`,
      userId: user.id,
      amount: val,
      type: TransactionType.DEBIT,
      category: TransactionCategory.OTHER,
      description: spendDesc,
      timestamp: Date.now()
    });
    if (res.success) { setSpendAmount(''); setSpendDesc(''); await sync(); }
  };

  const handleRequest = async () => {
    const val = parseFloat(requestAmount);
    if (!val || val <= 0 || !requestReason) return;
    const res = await storageService.createRequest(session, val, requestReason);
    if (res.success) { setRequestAmount(''); setRequestReason(''); await sync(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700">
       <div className="lg:col-span-4 space-y-10">
          <div className={`${CARD_STYLE} p-10 bg-indigo-600 text-white border-0 shadow-2xl`}>
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200 mb-2">Available Assets</p>
             <h2 className="text-5xl font-black tracking-tighter tabular-nums">{fmt(balance)}</h2>
             <div className="mt-8 pt-8 border-t border-indigo-500/50 flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-100">
                <span>Immutable State</span>
                <span>Active Ledger</span>
             </div>
          </div>

          <div className={CARD_STYLE}>
            <div className="px-8 py-5 border-b border-slate-100">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Log Expenditure</h3>
            </div>
            <div className="p-8 space-y-5">
               <input type="number" placeholder="Value (₹)" value={spendAmount} onChange={e => setSpendAmount(e.target.value)} className={INPUT_STYLE} />
               <input type="text" placeholder="Description / Purpose" value={spendDesc} onChange={e => setSpendDesc(e.target.value)} className={INPUT_STYLE} />
               <button onClick={handleSpend} className={`${BUTTON_PRIMARY} w-full`}>Commit Entry</button>
            </div>
          </div>

          <div className={`${CARD_STYLE} bg-slate-900 text-white border-0`}>
            <div className="px-8 py-5 border-b border-slate-800">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Request Funding</h3>
            </div>
            <div className="p-8 space-y-5">
               <input type="number" placeholder="Target Sum" value={requestAmount} onChange={e => setRequestAmount(e.target.value)} className={`${INPUT_STYLE} bg-slate-800 border-0 text-white placeholder:text-slate-500`} />
               <input type="text" placeholder="Financial Justification" value={requestReason} onChange={e => setRequestReason(e.target.value)} className={`${INPUT_STYLE} bg-slate-800 border-0 text-white placeholder:text-slate-500`} />
               <button onClick={handleRequest} className={`${BUTTON_PRIMARY} w-full bg-white text-slate-900 hover:bg-slate-100`}>Submit to Core</button>
            </div>
          </div>
       </div>

       <div className="lg:col-span-8 space-y-10">
          <div className={CARD_STYLE}>
             <div className="px-8 py-5 border-b border-slate-100">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-800">Audit Trail History</h3>
             </div>
             <div className="p-6">
                {myTxs.length === 0 && (
                  <div className="py-24 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.4em]">
                    LEDEGER SYNCED. NO RECORDS.
                  </div>
                )}
                {myTxs.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
             </div>
          </div>

          {parent && (
            <div className={CARD_STYLE}>
               <MessageThread 
                  messages={messages} 
                  users={users} 
                  currentUserId={session.userId} 
                  targetId={parent.id} 
                  onSend={async (txt) => { await storageService.sendMessage(session, parent.id, txt); await sync(); }}
               />
            </div>
          )}

          <HelpSection />
       </div>
    </div>
  );
};

// --- AUTH PAGES ---

const AuthPage: React.FC<{ 
  onLogin: (f: string, h: string, p: string) => Promise<void>;
  onSignup: (f: string, h: string, p: string) => Promise<void>;
  error: string | null;
}> = ({ onLogin, onSignup, error }) => {
  const [view, setView] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [f, setF] = useState('');
  const [h, setH] = useState('');
  const [p, setP] = useState('');

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 ${NEUTRAL_BG} transition-colors duration-1000 overflow-hidden relative`}>
       {/* Visual mindfulness anchor */}
       <MindfulnessTrigger />
       
       <div className="max-w-md w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 relative z-10">
          
          <div className="text-center space-y-4">
             <div className="inline-block p-4 bg-white border border-slate-100 rounded-3xl shadow-sm mb-4">
               <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center transform rotate-45">
                 <div className="w-4 h-4 bg-white rounded-sm -rotate-45"></div>
               </div>
             </div>
             <h1 className="text-5xl font-black tracking-tight text-slate-900 italic">
                ZenLedger<span className="text-indigo-600 not-italic font-medium">Cloud</span>
             </h1>
             <div className="flex items-center justify-center gap-4">
                <span className="h-[1px] w-12 bg-slate-200"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 whitespace-nowrap">Global Asset Cluster</p>
                <span className="h-[1px] w-12 bg-slate-200"></span>
             </div>
          </div>
          
          <div className={`${CARD_STYLE} p-12 md:p-14 border border-slate-200/50`}>
             <div className="flex bg-slate-50 rounded-2xl p-1.5 mb-12 ring-1 ring-slate-100">
                <button 
                  onClick={() => setView('LOGIN')} 
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-700 ${view === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Authorize
                </button>
                <button 
                  onClick={() => setView('SIGNUP')} 
                  className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-700 ${view === 'SIGNUP' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Establish
                </button>
             </div>

             <form onSubmit={async (e) => { e.preventDefault(); view === 'LOGIN' ? await onLogin(f, h, p) : await onSignup(f, h, p); }} className="space-y-6">
                <div className="space-y-5">
                  <div className="space-y-1">
                    <input type="text" placeholder="Cloud Identifier" value={f} onChange={e => setF(e.target.value)} className={INPUT_STYLE} />
                  </div>
                  <div className="space-y-1">
                    <input type="text" placeholder="Identity Handle" value={h} onChange={e => setH(e.target.value)} className={INPUT_STYLE} />
                  </div>
                  <div className="space-y-1">
                    <input type="password" placeholder="Passphrase" value={p} onChange={e => setP(e.target.value)} className={INPUT_STYLE} />
                  </div>
                </div>
                
                {error && (
                  <div className="text-[11px] font-bold text-rose-500 bg-rose-50/50 p-5 rounded-2xl border border-rose-100/40 animate-in fade-in slide-in-from-top-4">
                    SECURITY ALERT: {error}
                  </div>
                )}
                
                <button type="submit" className={`${BUTTON_PRIMARY} w-full mt-4`}>
                  {view === 'LOGIN' ? 'Verify Authority' : 'Provision Cluster'}
                </button>
             </form>
          </div>
          
          <div className="text-center">
             <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
               {BRAND_OWNER} 2026
             </p>
          </div>
       </div>
    </div>
  );
};

// --- APP CORE ---

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTxs] = useState<Transaction[]>([]);
  const [requests, setReqs] = useState<MoneyRequest[]>([]);
  const [messages, setMsgs] = useState<FamilyMessage[]>([]);

  const sync = useCallback(async () => {
    const [u, t, r] = await Promise.all([
      storageService.getUsers(),
      storageService.getTransactions(),
      storageService.getRequests()
    ]);
    setUsers(u);
    setTxs(t);
    setReqs(r);
    if (session) {
      const m = await storageService.getMessages(session);
      setMsgs(m);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      const active = storageService.getStoredSession(); 
      if (active) setSession(active);
      await sync();
      setLoading(false);
    })();
  }, [sync]);

  useEffect(() => {
    if (session && !storageService.getOnboardingStatus(session.userId)) setShowOnboarding(true);
  }, [session]);

  const handleLogin = async (f: string, h: string, p: string) => {
    const res = await storageService.login(f, h, p);
    if (res.success) { setSession(res.data!); setAuthError(null); await sync(); }
    else setAuthError(res.error!);
  };

  const handleSignup = async (f: string, h: string, p: string) => {
    const res = await storageService.signupFamily(f, h, p);
    if (res.success) await handleLogin(f, h, p);
    else setAuthError(res.error!);
  };

  const handleLogout = () => { storageService.logout(); setSession(null); };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
       <div className="w-12 h-12 bg-slate-900 rounded-2xl animate-spin mb-8"></div>
       <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-900">Synchronizing Unit Integrity...</p>
    </div>
  );

  if (!session) return <AuthPage onLogin={handleLogin} onSignup={handleSignup} error={authError} />;

  const curUser = users.find(u => u.id === session.userId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showOnboarding && <Onboarding role={session.role} onDismiss={() => { storageService.setOnboardingStatus(session.userId); setShowOnboarding(false); }} />}
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                 <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
              </div>
              <div className="hidden sm:block">
                 <h1 className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none">ZenLedger<span className="text-indigo-600 not-italic font-medium">Cloud</span></h1>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1.5">Cluster Operational Unit</p>
              </div>
           </div>
           
           <div className="flex items-center gap-8">
              <div className="flex flex-col items-end">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authenticated Node</span>
                 <span className="text-sm font-black text-slate-900">@{curUser?.username} <span className="text-indigo-600 font-bold ml-1.5 opacity-60">/ {session.role}</span></span>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600 transition-colors p-3 rounded-2xl hover:bg-rose-50 border border-transparent hover:border-rose-100">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                 </svg>
              </button>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 md:p-12 lg:p-16 pb-32">
         {session.role === UserRole.PARENT ? (
           <ParentDashboard 
              session={session} 
              users={users} 
              transactions={transactions} 
              requests={requests} 
              messages={messages} 
              sync={sync} 
              onLogout={handleLogout} 
           />
         ) : (
           <ChildDashboard 
              session={session} 
              user={curUser!} 
              transactions={transactions} 
              requests={requests} 
              messages={messages} 
              users={users} 
              sync={sync} 
           />
         )}
      </main>

      <footer className="max-w-7xl mx-auto px-8 py-16 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-10 text-slate-400">
         <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
              <div className="w-2 h-2 bg-slate-300 rounded-sm"></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">v16.5-PRO</span>
         </div>
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
           ZenLedger | Built & Maintained by <span className="text-slate-900">Jaydeep Balde 2026</span>
         </p>
      </footer>
    </div>
  );
};

export default App;
