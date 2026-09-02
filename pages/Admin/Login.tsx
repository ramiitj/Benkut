import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLogin: (email: string, role: 'admin' | 'user') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { const response=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'include',body:JSON.stringify({email,password})});const result=await response.json();setPassword('');if(!response.ok)throw Error(result.error||'Authentication failed');if(!result.admin||!result.mfaVerified)throw Error('Administrator claim and MFA are required');onLogin(result.email,'admin');navigate('/admin/insights'); } catch(error){setError(error instanceof Error?error.message:'Authentication failed');}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-xl border border-stone-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
             <span className="material-symbols-outlined text-4xl text-primary-content">skillet</span>
          </div>
          <h1 className="text-2xl font-display font-black text-stone-900">Admin Portal</h1>
          <p className="text-stone-500">Authorized personnel only.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
              placeholder="admin@benkut.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full h-14 bg-stone-900 text-white rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-stone-900/10 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">lock_open</span>
            Authenticate
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-100 text-center">
          <button onClick={() => navigate('/')} className="text-sm font-bold text-stone-400 hover:text-stone-600">
            Return to Benkut
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
