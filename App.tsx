
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, UserRole, Transaction, TransactionType, Session, 
  TransactionCategory, MoneyRequest, RequestStatus, FamilyMessage
} from './types';
import { storageService, ENTERPRISE_CONFIG } from './services/storageService';
import { Onboarding } from './components/Onboarding';
import { HelpSection } from './components/HelpSection';
import { WarningIcon, InfoIcon, ClockIcon } from './constants';
import { GoogleGenAI } from "@google/genai";

const APP_VERSION = "v16.5-PRO";
const BRAND_OWNER = "Jaydeep B.11";

// --- PROFESSIONAL DESIGN TOKENS ---
const GLASS_CARD = "bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]";
const PREMIUM_ROUNDING = "rounded-[2rem] md:rounded-[3rem]";
const INPUT_STYLE = "w-full bg-slate-100/50 px-6 py-4 rounded-2xl font-semibold text-slate-800 outline-none border border-transparent focus:bg-white focus:border-indigo-500 transition-all duration-300 shadow-sm";

// --- HELPERS ---
const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
const relTime = (t: number) => {
  const d = Date.now() - t;
  if (d < 60000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(t).toLocaleDateString();
};

// --- SHARED COMPONENTS ---
const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  const styles = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-900' };
  return (
    <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] ${styles[type]} text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500`}>
      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{message}</p>
    </div>
  );
};

const AIInsight: React.FC<{ prompt: string; label: string; icon: string; theme: 'dark' | 'light' | 'emerald' }> = ({ prompt, label, icon, theme }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
        setContent(res.text || "Synchronizing data layers...");
      } catch { setContent("Intelligence module currently optimizing."); } finally { setLoading(false); }
    })();
  }, [prompt]);

  const themes = {
    dark: "bg-slate-900 text-white border-white/5",
    light: "bg-white text-slate-900 border-slate-100",
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-100"
  };

  return (
    <div className={`${themes[theme]} border ${PREMIUM_ROUNDING} p-8 flex items-start gap-6 transition-all duration-500 hover:shadow-lg`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl shadow-inner ${theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}>{icon}</div>
      <div>
        <p className={`text-[9px] font-black uppercase tracking-[0.4em] mb-2 ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`}>{label}</p>
        <p className="text-sm font-bold leading-relaxed italic">{loading ? "Processing..." : content}</p>
      </div>
    </div>
  );
};

// --- CHILD VIEW ---
const ChildDashboard: React.FC<{ 
  session: Session; user: User; transactions: Transaction[]; 
  requests: MoneyRequest[]; messages: FamilyMessage[]; 
  onAction: (m: string, t: any) => void; sync: () => void 
}> = ({ session, user, transactions, requests, messages, onAction, sync }) => {
  const [amt, setAmt] = useState(''); const [desc, setDesc] = useState('');
  const [reqAmt, setReqAmt] = useState(''); const [reqReason, setReqReason] = useState('');
  const [reply, setReply] = useState(''); const [activeMid, setActiveMid] = useState<string | null>(null);

  const myTxs = useMemo(() => transactions.filter(t => t.userId === user.id), [transactions, user.id]);
  const balance = useMemo(() => myTxs.reduce((a, t) => t.type === TransactionType.CREDIT ? a + t.amount : a - t.amount, 0), [myTxs]);
  const myMsgs = useMemo(() => messages.filter(m => m.toId === user.id), [messages, user.id]);

  const handleSpend = async () => {
    const v = parseFloat(amt); if (!v || v <= 0 || !desc.trim()) return onAction('Incomplete data.', 'error');
    if (v > balance) return onAction('Insufficient balance.', 'error');
    const res = await storageService.saveTransaction(session, {
      id: `tx_${Date.now()}`, userId: user.id, amount: v, type: TransactionType.DEBIT, category: TransactionCategory.FOOD, description: desc.trim(), timestamp: Date.now()
    });
    if (res.success) { setAmt(''); setDesc(''); onAction('Ledger updated.', 'success'); sync(); }
  };

  const handleRequest = async () => {
    const v = parseFloat(reqAmt); if (!v || v <= 0 || !reqReason.trim()) return onAction('Missing request info.', 'error');
    const res = await storageService.createRequest(session, v, reqReason.trim());
    if (res.success) { setReqAmt(''); setReqReason(''); onAction('Request dispatched.', 'success'); sync(); }
  };

  const handleReply = async (msgId: string, toId: string) => {
    if (!reply.trim()) return;
    const res = await storageService.sendMessage(session, toId, reply.trim(), msgId);
    if (res.success) { setReply(''); setActiveMid(null); onAction('Note sent.', 'success'); sync(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-4 space-y-8">
        <div className={`bg-gradient-to-br from-emerald-600 to-emerald-700 ${PREMIUM_ROUNDING} p-12 text-white shadow-2xl relative overflow-hidden group`}>
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000"><span className="text-9xl font-black">₹</span></div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-4 opacity-70">Asset Liquidity</p>
          <h2 className="text-6xl font-black tracking-tighter tabular-nums mb-10">{fmt(balance)}</h2>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse shadow-glow" />
            <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-80">Local Sync Active</span>
          </div>
        </div>
        <AIInsight theme="emerald" icon="✨" label="AI Support" prompt={`Supportive note for child. Balance: ₹${balance}. Max 12 words. Pro tone.`} />
        <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-10`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Execute Outflow</h3>
          <div className="space-y-4">
            <input type="number" placeholder="Value (₹)" value={amt} onChange={e => setAmt(e.target.value)} className={INPUT_STYLE} />
            <input type="text" placeholder="Purpose" value={desc} onChange={e => setDesc(e.target.value)} className={INPUT_STYLE} />
            <button onClick={handleSpend} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.4em] hover:bg-emerald-600 transition-all shadow-xl">Commit Record</button>
          </div>
        </div>
        <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-10 border-indigo-100 bg-indigo-50/20`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-8">Asset Request</h3>
          <div className="space-y-4">
            <input type="number" placeholder="Target Sum" value={reqAmt} onChange={e => setReqAmt(e.target.value)} className={INPUT_STYLE.replace('bg-slate-100/50', 'bg-white')} />
            <input type="text" placeholder="Reasoning" value={reqReason} onChange={e => setReqReason(e.target.value)} className={INPUT_STYLE.replace('bg-slate-100/50', 'bg-white')} />
            <button onClick={handleRequest} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.4em] hover:bg-indigo-700 shadow-xl">Notify Parent</button>
          </div>
        </div>
      </div>
      <div className="lg:col-span-8 space-y-8">
        {myMsgs.length > 0 && (
          <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-10 border-indigo-200 ring-8 ring-indigo-50/30`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-10">Secure Communications</h3>
            <div className="space-y-4">
              {myMsgs.map(m => (
                <div key={m.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 transition-all hover:bg-white group">
                  <p className="text-lg font-bold text-slate-800 italic mb-4">"{m.text}"</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{relTime(m.timestamp)}</p>
                    {activeMid === m.id ? (
                      <div className="flex-1 ml-8 flex gap-3 animate-in slide-in-from-right-2">
                        <input autoFocus type="text" placeholder="Type reply..." value={reply} onChange={e => setReply(e.target.value)} className="flex-1 bg-white px-6 py-3 rounded-xl border border-indigo-100 font-bold text-sm outline-none" />
                        <button onClick={() => handleReply(m.id, m.fromId)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Send</button>
                        <button onClick={() => setActiveMid(null)} className="text-[9px] font-black uppercase text-slate-400">Close</button>
                      </div>
                    ) : (
                      <button onClick={() => { setActiveMid(m.id); storageService.markMessageRead(m.id); }} className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-600"> Respond</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-12`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-12 italic">Historical Audit Trail</h3>
          <div className="space-y-4">
            {myTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-transparent hover:border-slate-100 transition-all duration-300">
                <div className="flex items-center gap-5">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${tx.type === TransactionType.CREDIT ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {tx.type === TransactionType.CREDIT ? '↓' : '↑'}
                   </div>
                   <div>
                      <p className="text-base font-bold text-slate-900">{tx.description}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{relTime(tx.timestamp)} • {tx.category}</p>
                   </div>
                </div>
                <div className={`text-2xl font-black tabular-nums ${tx.type === TransactionType.CREDIT ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {tx.type === TransactionType.CREDIT ? '+' : '-'}{tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
            {myTxs.length === 0 && <p className="py-24 text-center text-slate-300 font-black uppercase tracking-[0.6em] text-xs">Ledger Clear</p>}
          </div>
        </div>
        <HelpSection />
      </div>
    </div>
  );
};

// --- PARENT VIEW ---
const ParentDashboard: React.FC<{ 
  session: Session; users: User[]; transactions: Transaction[]; 
  requests: MoneyRequest[]; messages: FamilyMessage[]; 
  onAction: (m: string, t: any) => void; sync: () => void; onWipe: () => void 
}> = ({ session, users, transactions, requests, messages, onAction, sync, onWipe }) => {
  const [cH, setCH] = useState(''); const [cP, setCP] = useState('');
  const [at, setAt] = useState<{id: string, name: string} | null>(null); const [aa, setAa] = useState('');
  const [mt, setMt] = useState<{id: string, name: string} | null>(null); const [mx, setMx] = useState('');

  const children = useMemo(() => users.filter(u => u.role === UserRole.CHILD && u.familyId === session.familyId), [users, session.familyId]);
  const pool = useMemo(() => children.reduce((acc, c) => acc + transactions.filter(t => t.userId === c.id).reduce((a, tx) => tx.type === TransactionType.CREDIT ? a + tx.amount : a - tx.amount, 0), 0), [children, transactions]);
  const pending = useMemo(() => requests.filter(r => r.status === RequestStatus.PENDING), [requests]);

  const addNode = async () => {
    if (!cH.trim() || !cP.trim()) return onAction('Handle/Passphrase required.', 'error');
    const res = await storageService.createChild(session, cH, cP);
    if (res.success) { setCH(''); setCP(''); onAction('Member established.', 'success'); sync(); }
  };

  const handleReq = async (r: MoneyRequest, s: RequestStatus) => {
    const res = await storageService.updateRequestStatus(session, r.id, s);
    if (res.success) {
      if (s === RequestStatus.APPROVED) {
        await storageService.saveTransaction(session, {
          id: `tx_${Date.now()}`, userId: r.childId, amount: r.amount, type: TransactionType.CREDIT, category: TransactionCategory.ALLOWANCE, description: `Approved: ${r.reason}`, timestamp: Date.now()
        });
        onAction(`Approved funding of ₹${r.amount}.`, 'success');
      } else onAction('Request rejected.', 'info');
      sync();
    }
  };

  const allocFunds = async () => {
    const v = parseFloat(aa); if (!v || !at) return;
    const res = await storageService.saveTransaction(session, {
      id: `tx_${Date.now()}`, userId: at.id, amount: v, type: TransactionType.CREDIT, category: TransactionCategory.ALLOWANCE, description: 'Direct Liquidity Injection', timestamp: Date.now()
    });
    if (res.success) { setAt(null); setAa(''); onAction(`Allocated to ${at.name}.`, 'success'); sync(); }
  };

  const sendNote = async () => {
    if (!mx.trim() || !mt) return;
    const res = await storageService.sendMessage(session, mt.id, mx.trim());
    if (res.success) { setMt(null); setMx(''); onAction('Note dispatched.', 'success'); sync(); }
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-8">
          <div className={`bg-slate-900 ${PREMIUM_ROUNDING} p-16 md:p-24 text-white h-full relative overflow-hidden flex flex-col justify-center shadow-4xl`}>
             <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12 scale-150 pointer-events-none"><span className="text-[12rem] font-black">CLOUD</span></div>
             <p className="text-[11px] font-black uppercase tracking-[0.6em] mb-10 text-indigo-400">Aggregated Cluster Capital</p>
             <h2 className="text-7xl md:text-9xl font-black tracking-tighter tabular-nums mb-12 leading-none">{fmt(pool)}</h2>
             <div className="flex gap-6">
                <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                   Enterprise Sync: Active
                </div>
             </div>
          </div>
        </div>
        <div className="lg:col-span-4">
          <AIInsight theme="dark" icon="📊" label="System Insight" prompt={`Family pool: ₹${pool}. Professional strategy idea for parents. Max 15 words. High-end tone.`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {pending.length > 0 && (
            <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-10 border-indigo-200 ring-[16px] ring-indigo-50/10`}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-8 flex items-center gap-4">
                 <span className="w-4 h-4 rounded-full bg-indigo-500 animate-ping" />
                 Authorizations Required
              </h3>
              <div className="space-y-4">
                {pending.map(r => {
                  const child = users.find(u => u.id === r.childId);
                  return (
                    <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between p-8 bg-slate-50 rounded-[3rem] border border-slate-100 hover:bg-white transition-all shadow-sm gap-6">
                       <div>
                         <p className="text-xl font-black text-slate-900">@{child?.username} requests {fmt(r.amount)}</p>
                         <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2">Reason: {r.reason}</p>
                       </div>
                       <div className="flex gap-4">
                         <button onClick={() => handleReq(r, RequestStatus.APPROVED)} className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 active:scale-95">Approve</button>
                         <button onClick={() => handleReq(r, RequestStatus.REJECTED)} className="px-10 py-4 bg-white border border-slate-200 text-slate-400 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95">Reject</button>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-12`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-12 italic">Cluster Node Registry</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {children.map(c => {
                const b = transactions.filter(t => t.userId === c.id).reduce((acc, tx) => tx.type === TransactionType.CREDIT ? acc + tx.amount : acc - tx.amount, 0);
                const isA = at?.id === c.id; const isM = mt?.id === c.id;
                return (
                  <div key={c.id} className={`p-10 rounded-[3.5rem] transition-all duration-700 flex flex-col ${isA || isM ? 'bg-indigo-600 text-white shadow-3xl scale-[1.03]' : 'bg-slate-50 border border-slate-100 hover:border-indigo-100'}`}>
                    <p className={`text-[9px] font-black uppercase mb-4 tracking-[0.4em] ${isA || isM ? 'text-indigo-200' : 'text-slate-400'}`}>@{c.username}</p>
                    <p className={`text-5xl font-black mb-12 tabular-nums ${isA || isM ? 'text-white' : 'text-slate-900'}`}>{fmt(b)}</p>
                    {isA ? (
                      <div className="space-y-4 animate-in zoom-in-95">
                        <input autoFocus type="number" placeholder="Amount (₹)" value={aa} onChange={e => setAa(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-[1.5rem] px-8 py-5 text-sm font-bold placeholder:text-white/30 outline-none" />
                        <div className="flex gap-3">
                          <button onClick={allocFunds} className="flex-1 py-5 bg-white text-indigo-600 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-2xl">Confirm</button>
                          <button onClick={() => setAt(null)} className="px-6 py-5 bg-white/10 rounded-[1.5rem] font-black uppercase text-[10px]">Cancel</button>
                        </div>
                      </div>
                    ) : isM ? (
                      <div className="space-y-4 animate-in zoom-in-95">
                        <textarea autoFocus placeholder="Note text..." value={mx} onChange={e => setMx(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-[1.5rem] px-8 py-5 text-sm font-bold placeholder:text-white/30 outline-none h-32 resize-none" />
                        <div className="flex gap-3">
                          <button onClick={sendNote} className="flex-1 py-5 bg-white text-indigo-600 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-2xl">Send</button>
                          <button onClick={() => setMt(null)} className="px-6 py-5 bg-white/10 rounded-[1.5rem] font-black uppercase text-[10px]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 mt-auto">
                        <button onClick={() => { setAt({id: c.id, name: c.username}); setMt(null); }} className="w-full py-6 bg-white border border-slate-100 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm">Allocate Capital</button>
                        <button onClick={() => { setMt({id: c.id, name: c.username}); setAt(null); }} className="w-full py-6 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Direct Note</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {children.length === 0 && <p className="md:col-span-2 py-32 text-center text-slate-300 font-black uppercase tracking-[0.8em] text-xs">Node Deployment Pending</p>}
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 space-y-10">
          <div className={`${GLASS_CARD} ${PREMIUM_ROUNDING} p-10`}>
             <h3 className="text-[10px] font-black uppercase text-slate-400 mb-8 tracking-[0.4em]">Provision Node</h3>
             <div className="space-y-5">
                <input type="text" placeholder="Handle" value={cH} onChange={e => setCH(e.target.value)} className={INPUT_STYLE} />
                <input type="password" placeholder="Passphrase" value={cP} onChange={e => setCP(e.target.value)} className={INPUT_STYLE} />
                <button onClick={addNode} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase text-[11px] tracking-[0.4em] shadow-3xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all">Authorize Node</button>
             </div>
          </div>
          <div className={`bg-rose-50/50 ${PREMIUM_ROUNDING} p-10 border border-rose-100 group shadow-sm`}>
            <h3 className="text-[10px] font-black uppercase text-rose-900 mb-6 tracking-[0.4em] flex items-center gap-3">
               <WarningIcon className="w-6 h-6 text-rose-500" /> Infrastructure Wipe
            </h3>
            <p className="text-[10px] text-rose-700/60 mb-10 leading-relaxed font-bold uppercase tracking-tight">PROTOCOL ALERT: Permanently erase the entire cluster ledger and node records.</p>
            <button onClick={onWipe} className="w-full bg-rose-600 text-white py-5 rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] hover:bg-rose-700 shadow-xl shadow-rose-100 active:scale-[0.98] transition-all">Execute Wipe</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CORE APP ---
const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [v, setV] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [load, setLoad] = useState(true);
  const [t, setT] = useState<{ msg: string, type: any } | null>(null);
  const [demo, setDemo] = useState(false);
  const [onb, setOnb] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [reqs, setReqs] = useState<MoneyRequest[]>([]);
  const [msgs, setMsgs] = useState<FamilyMessage[]>([]);

  const [f, setF] = useState(''); const [h, setH] = useState(''); const [p, setP] = useState('');
  const [sf, setSf] = useState(''); const [sh, setSh] = useState(''); const [sp, setSp] = useState('');

  const trig = (msg: string, type: any = 'info') => setT({ msg, type });
  
  // Fixed: storageService methods return Promises, so sync must be async and await them.
  const sync = useCallback(async () => { 
    const u = await storageService.getUsers(); 
    const t = await storageService.getTransactions(); 
    const r = await storageService.getRequests(); 
    const m = await storageService.getMessages(); 
    setUsers(u); 
    setTxs(t); 
    setReqs(r); 
    setMsgs(m); 
  }, []);

  useEffect(() => {
    (async () => {
      // Fixed: storageService.getUsers() returns a Promise, must await it.
      const u = await storageService.getUsers();
      if (!u.some(x => x.familyId === 'demo_cluster')) {
        await storageService.signupFamily('demo_cluster', 'admin', 'pass123');
        // Fixed: refresh user list after potential signup
        const updatedUsers = await storageService.getUsers();
        const adm = updatedUsers.find(x => x.username === 'admin' && x.familyId === 'demo_cluster');
        if (adm) {
          const fs: Session = { token: 't', userId: adm.id, familyId: 'demo_cluster', role: UserRole.PARENT, exp: Date.now() + 9999999 };
          await storageService.createChild(fs, 'child', 'pass123');
        }
      }
      const active = storageService.getStoredSession(); if (active) setSession(active); await sync();
      setTimeout(() => setLoad(false), 1800);
    })();
  }, [sync]);

  useEffect(() => { if (session && !storageService.getOnboardingStatus(session.userId)) setOnb(true); }, [session]);

  const doLogin = async (e: any) => {
    e.preventDefault(); const r = await storageService.login(f, h, p);
    if (r.success) { setSession(r.data!); await sync(); trig('Node Authorized.', 'success'); setF(''); setH(''); setP(''); }
    else trig(r.error!, 'error');
  };

  const doSignup = async (e: any) => {
    e.preventDefault(); const r = await storageService.signupFamily(sf, h, sp);
    if (r.success) { trig('Cluster Established.', 'success'); setV('LOGIN'); setSf(''); setSh(''); setSp(''); }
    else trig(r.error!, 'error');
  };

  if (load) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-12">
       <div className="w-16 h-16 bg-slate-900 rounded-[2.5rem] mb-12 shadow-4xl rotate-45 animate-pulse" />
       <div className="text-[12px] font-black tracking-[1em] text-slate-900 uppercase">Synchronizing Network Integrity</div>
    </div>
  );

  if (!session) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 md:p-24 overflow-hidden relative">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none flex flex-wrap gap-12 items-center justify-center">
         {Array.from({length: 40}).map((_, i) => <div key={i} className="text-9xl font-black rotate-12">ZENLEDGER</div>)}
      </div>
      {t && <Toast message={t.msg} type={t.type} onClose={() => setT(null)} />}
      <div className="max-w-4xl w-full relative z-10">
        <div className="text-center mb-24 animate-in fade-in duration-1000 scale-110">
           <h1 className="text-8xl md:text-10xl font-black italic text-slate-900 tracking-tighter leading-none mb-6">ZenLedger<span className="text-indigo-600 not-italic">Cloud</span></h1>
           <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.8em] mb-4">Unified Family Financial Governance</p>
           <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] opacity-80">Enterprise Cluster • Managed by {BRAND_OWNER}</p>
        </div>
        <div className={`${GLASS_CARD} max-w-xl mx-auto p-16 md:p-20 ${PREMIUM_ROUNDING} ring-1 ring-white/50 shadow-5xl animate-in zoom-in-95 duration-700`}>
           <div className="flex bg-slate-100/50 rounded-3xl p-2 mb-16 shadow-inner border border-slate-200/50">
             <button onClick={() => setV('LOGIN')} className={`flex-1 py-5 text-[11px] font-black uppercase tracking-[0.4em] rounded-[1.2rem] transition-all duration-700 ${v === 'LOGIN' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Authorize</button>
             <button onClick={() => setV('SIGNUP')} className={`flex-1 py-5 text-[11px] font-black uppercase tracking-[0.4em] rounded-[1.2rem] transition-all duration-700 ${v === 'SIGNUP' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Establish</button>
           </div>
           <form onSubmit={v === 'LOGIN' ? doLogin : doSignup} className="space-y-8">
             <div className="relative">
                <input type="text" placeholder={v === 'LOGIN' ? "Cloud ID" : "New Cluster ID"} value={v === 'LOGIN' ? f : sf} onChange={e => v === 'LOGIN' ? setF(e.target.value) : setSf(e.target.value)} className={INPUT_STYLE} />
                {v === 'LOGIN' && <button type="button" onClick={() => setDemo(!demo)} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500"><InfoIcon /></button>}
             </div>
             <input type="text" placeholder="Identity Handle" value={v === 'LOGIN' ? h : sh} onChange={e => v === 'LOGIN' ? setH(e.target.value) : setSh(e.target.value)} className={INPUT_STYLE} />
             <input type="password" placeholder="Passphrase" value={v === 'LOGIN' ? p : sp} onChange={e => v === 'LOGIN' ? setP(e.target.value) : setSp(e.target.value)} className={INPUT_STYLE} />
             {demo && <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] text-[11px] font-mono border border-white/10 shadow-3xl animate-in slide-in-from-top-2"><p className="opacity-40 mb-3 tracking-widest uppercase italic">Demo credentials:</p><p className="tracking-tight">ID: demo_cluster • HANDLE: admin • PASS: pass123</p></div>}
             <button className="w-full bg-slate-900 text-white py-10 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.6em] hover:bg-indigo-600 transition-all shadow-4xl active:scale-[0.98]">Establish Authority</button>
           </form>
        </div>
      </div>
    </div>
  );

  const cur = users.find(u => u.id === session.userId);

  return (
    <div className="max-w-[1440px] mx-auto px-8 md:px-16 lg:px-24 py-16 md:py-32 animate-in fade-in duration-1000">
      {t && <Toast message={t.msg} type={t.type} onClose={() => setT(null)} />}
      {onb && <Onboarding role={session.role} onDismiss={() => { storageService.setOnboardingStatus(session.userId); setOnb(false); }} />}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-32 gap-16 border-b border-slate-200 pb-20">
        <div className="flex items-center gap-10">
           <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-5xl group relative overflow-hidden flex-shrink-0 transition-transform hover:scale-105 duration-500">
              <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-700 opacity-90" />
              <div className="w-10 h-10 bg-white rounded-md rotate-45 relative z-10 transition-transform group-hover:rotate-[225deg] duration-700 shadow-sm" />
           </div>
           <div>
              <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-slate-900 leading-none mb-4">ZenLedger<span className="text-indigo-600 not-italic">Cloud</span></h1>
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                 <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] leading-none">Global Asset Governance</p>
                 <div className="hidden md:block w-px h-4 bg-slate-200" />
                 <div className="px-6 py-3 bg-white rounded-full border border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-4 shadow-sm">
                   <div className={`w-3 h-3 rounded-full ${session.role === UserRole.PARENT ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-600 shadow-emerald-200'} animate-pulse shadow-glow`} />
                   <span className="text-slate-900">{session.familyId}</span>
                   <span className="opacity-20 text-xl">/</span>
                   <span className="text-indigo-600">@{cur?.username}</span>
                 </div>
              </div>
           </div>
        </div>
        <button onClick={() => { storageService.logout(); setSession(null); trig('Authority withdrawn.', 'info'); }} className="px-16 py-8 bg-slate-900 text-white rounded-[3rem] text-[12px] font-black uppercase tracking-[0.4em] hover:bg-rose-600 transition-all shadow-4xl active:scale-95">Secure Exit</button>
      </header>

      {session.role === UserRole.PARENT ? (
        <ParentDashboard session={session} users={users} transactions={txs} requests={reqs} messages={msgs} onAction={(m, t) => setT({msg:m, type:t})} sync={sync} onWipe={() => { if(confirm('Execute System Wipe?')) { storageService.clearAll(session); setSession(null); sync(); window.location.reload(); } }} />
      ) : (
        <ChildDashboard session={session} user={cur!} transactions={txs} requests={reqs} messages={msgs} onAction={(m, t) => setT({msg:m, type:t})} sync={sync} />
      )}

      <footer className="mt-48 py-24 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-16 opacity-30 group">
        <div className="flex items-center gap-8">
          <div className="w-16 h-16 rounded-[2rem] bg-slate-900 flex items-center justify-center transition-transform group-hover:rotate-180 duration-1000 shadow-2xl">
            <div className="w-6 h-6 bg-white rounded-sm" />
          </div>
          <div className="flex flex-col">
             <span className="text-[16px] font-black uppercase tracking-[0.8em] text-slate-900">ZenLedger Asset Standard</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Family Wealth Control</span>
          </div>
        </div>
        <div className="flex flex-col md:items-end gap-3 text-center md:text-right">
           <span className="text-[14px] font-bold text-slate-900 uppercase tracking-[0.5em] italic">Conceptualized by {BRAND_OWNER}</span>
           <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">Global Asset Distribution Standard • {APP_VERSION}</span>
           <div className="flex flex-col md:items-end gap-1 mt-6">
              <span className="text-[8px] font-mono text-slate-300 uppercase tracking-tighter opacity-50 italic truncate max-w-[400px] select-all hover:opacity-100 transition-opacity bg-slate-100 p-1 px-3 rounded-full">{ENTERPRISE_CONFIG.MONGO_URI}</span>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
