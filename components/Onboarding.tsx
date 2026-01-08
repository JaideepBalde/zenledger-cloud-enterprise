
import React from 'react';
import { UserRole } from '../types';

interface OnboardingProps {
  role: UserRole;
  onDismiss: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ role, onDismiss }) => {
  const isParent = role === UserRole.PARENT;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6">
      <div className="bg-white rounded-[3.5rem] shadow-5xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-500 border border-white/50 ring-1 ring-slate-200">
        <div className={`h-2 ${isParent ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
        <div className="p-16">
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter italic">
            ZenLedger<span className="text-indigo-600 not-italic">Cloud</span>
          </h2>
          <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.8em] mb-12">System Protocol Briefing</p>
          
          <div className="space-y-10 text-slate-600">
            {isParent ? (
              <>
                <p className="font-black text-slate-900 uppercase text-[11px] tracking-[0.5em] mb-4">Executive Mandates:</p>
                <ul className="space-y-6">
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-indigo-50 text-indigo-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">01</span>
                    <span>Provision family nodes for each child member.</span>
                  </li>
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-indigo-50 text-indigo-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">02</span>
                    <span>Execute periodic CREDIT allocations.</span>
                  </li>
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-indigo-50 text-indigo-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">03</span>
                    <span>Review historical ledger audit trails globally.</span>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-black text-slate-900 uppercase text-[11px] tracking-[0.5em] mb-4">Member Mandates:</p>
                <ul className="space-y-6">
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-emerald-50 text-emerald-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">01</span>
                    <span>Monitor individual asset liquidity in real-time.</span>
                  </li>
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-emerald-50 text-emerald-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">02</span>
                    <span>Log all expenses (DEBIT) with precise details.</span>
                  </li>
                  <li className="flex items-start text-base font-bold text-slate-700">
                    <span className="bg-emerald-50 text-emerald-600 rounded-xl w-8 h-8 flex items-center justify-center text-[12px] font-black mt-0.5 mr-5 shrink-0 shadow-sm">03</span>
                    <span>Understand that all entries are permanent records.</span>
                  </li>
                </ul>
              </>
            )}
          </div>

          <button
            onClick={onDismiss}
            className={`mt-16 w-full py-6 px-10 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.4em] text-white transition-all shadow-4xl active:scale-[0.98] ${
              isParent ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Acknowledge & Sync
          </button>
        </div>
      </div>
    </div>
  );
};
