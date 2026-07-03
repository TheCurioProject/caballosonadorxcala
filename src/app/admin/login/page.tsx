'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoCompleto } from '@/components/ui/LogoCompleto';
import { AnimatedHorse } from '@/components/ui/AnimatedHorse';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let isLoginSuccessful = false;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        isLoginSuccessful = true;
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/admin');
          router.refresh();
        }, 1500);
      } else {
        const data = await res.json();
        setError(data.details ? `${data.error}: ${data.details}` : data.error || 'Login fallido');
      }
    } catch (err) {
      const e = err as Error;
      setError(`Error de red: ${e.message || 'Intenta de nuevo.'}`);
    } finally {
      if (!isLoginSuccessful) setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F7F4] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none w-[150%] md:w-[80%] z-0">
        <LogoCompleto solidWhite={false} className="w-full h-auto" />
      </div>

      <div className="bg-white p-10 md:p-14 rounded-[2rem] shadow-2xl border border-[#E5E0D8] w-full max-w-md relative z-10 mx-4 min-h-[450px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {(isLoading || isSuccess) ? (
            <motion.div
              key="loading-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="text-[#9B7E67]">
                <AnimatedHorse size="lg" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-[#23211F] mb-2">
                  {isSuccess ? 'Acceso Concedido' : 'Validando...'}
                </h3>
                <p className="text-[#9B7E67] text-sm uppercase tracking-widest font-medium">
                  {isSuccess ? 'Ingresando al panel...' : 'Preparando su establo...'}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
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
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#F9F7F4] border border-[#E5E0D8] rounded-xl px-12 py-4 focus:outline-none focus:border-[#9B7E67] transition-colors"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#9B7E67] transition-colors focus:outline-none"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={showPassword ? 'eyeOff' : 'eye'}
                          initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                          transition={{ duration: 0.15 }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </motion.div>
                      </AnimatePresence>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#23211F] text-[#F9F7F4] rounded-xl py-4 uppercase tracking-widest text-xs font-bold hover:bg-[#9B7E67] transition-colors disabled:opacity-50 mt-4"
                >
                  Iniciar Sesión
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
