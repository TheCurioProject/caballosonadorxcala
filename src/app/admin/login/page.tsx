'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User } from 'lucide-react';
import { LogoCompleto } from '@/components/ui/LogoCompleto';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Login fallido');
      }
    } catch (err) {
      setError('Error de red. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F7F4] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none w-[150%] md:w-[80%] z-0">
        <LogoCompleto solidWhite={false} className="w-full h-auto" />
      </div>

      <div className="bg-white p-10 md:p-14 rounded-[2rem] shadow-2xl border border-[#E5E0D8] w-full max-w-md relative z-10 mx-4">
        <div className="text-center mb-10">
          <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-2">Panel de Control</h2>
          <h1 className="font-serif text-4xl text-[#23211F]">Acceso Seguro</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Usuario</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <User size={18} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#F9F7F4] border border-[#E5E0D8] rounded-xl px-12 py-4 focus:outline-none focus:border-[#9B7E67] transition-colors"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Contraseña</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F9F7F4] border border-[#E5E0D8] rounded-xl px-12 py-4 focus:outline-none focus:border-[#9B7E67] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#23211F] text-[#F9F7F4] rounded-xl py-4 uppercase tracking-widest text-xs font-bold hover:bg-[#9B7E67] transition-colors disabled:opacity-50 mt-4"
          >
            {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
