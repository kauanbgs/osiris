import { useState } from 'react';
import { Mail, KeyRound, LogIn } from 'lucide-react';
import DotField from '@/components/DotField';

export default function Login() {
    
    return (
        <div className="relative min-h-screen w-full bg-zinc-950 flex items-center justify-center px-4 py-12 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <DotField
                    dotRadius={1.5}
                    dotSpacing={14}
                    bulgeStrength={67}
                    glowRadius={160}
                    sparkle={false}
                    waveAmplitude={0}
                    cursorRadius={500}
                    cursorForce={0.1}
                    bulgeOnly
                    gradientFrom="#A855F7"
                    gradientTo="#B497CF"
                    glowColor="#120F17"
                />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <h1 className="font-mono text-6xl font-bold text-zinc-100 text-center mb-10">
                    Osíris
                </h1>

                <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8">
                    <div className="mb-6">
                        <label className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2">
                            <Mail size={16} strokeWidth={1.75} />
                            E-mail
                        </label>
                        <input
                            type="email"
                            placeholder="arthurLacerda@gmail.com"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>

                    <div className="mb-8">
                        <label className="flex items-center gap-2 font-mono text-sm text-zinc-200 mb-2">
                            <KeyRound size={16} strokeWidth={1.75} />
                            Senha
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>

                    <button
                        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 rounded-lg py-3 font-mono font-semibold text-white transition-colors"
                    >
                        Iniciar Sessão
                    </button>
                </div>

                <p className="text-center font-mono text-sm text-zinc-400 mt-6">
                    Não tem conta?{' '}
                    <a href="#" className="text-violet-400 hover:text-violet-300 transition-colors">
                        se cadastre!
                    </a>
                </p>
            </div>
        </div>
    );
}