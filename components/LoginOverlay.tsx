"use client";

import React, { useState } from 'react';
import { Shield, Mail, User, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

interface LoginOverlayProps {
    onLoginSuccess: () => void;
}

export default function LoginOverlay({ onLoginSuccess }: LoginOverlayProps) {
    const [disclaimer, setDisclaimer] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!disclaimer) {
            setError('You must accept the disclaimer to proceed.');
            return;
        }
        if (!code) {
            setError('Trader Access Key is required.');
            return;
        }
        setError('');
        setLoading(true);

        const defaultName = 'Trader';
        const defaultEmail = 'trader@access.com';

        try {
            // 1. Get Signup Token (Stateless info carrier)
            const sendCodeRes = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: defaultName,
                    email: defaultEmail,
                    disclaimerAccepted: disclaimer
                }),
            });

            if (!sendCodeRes.ok) {
                const data = await sendCodeRes.json();
                setError(data.error || 'Identity verification failed.');
                setLoading(false);
                return;
            }

            const { signupToken } = await sendCodeRes.json();

            // 2. Verify Access Key
            const verifyRes = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: defaultEmail,
                    code,
                    signupToken
                }),
            });

            if (verifyRes.ok) {
                onLoginSuccess();
            } else {
                const data = await verifyRes.json();
                setError(data.error || 'Invalid Trader Access Key.');
            }
        } catch (err) {
            setError('Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/90 backdrop-blur-xl p-4">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <Shield className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-center text-white mb-2">
                        DP Trade Desk
                    </h2>
                    <p className="text-gray-200 text-center text-sm mb-8">
                        Scientific Price Analysis & Intelligence
                    </p>

                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-xs text-center justify-center">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="text-center">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">
                                Trader Access Key
                            </label>

                            <input
                                type="password"
                                placeholder="••••••••"
                                required
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-4 text-center text-2xl font-black tracking-widest text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder-gray-700"
                            />
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="disclaimer"
                                    checked={disclaimer}
                                    onChange={(e) => setDisclaimer(e.target.checked)}
                                    className="mt-1 block h-4 w-4 bg-gray-800 border-gray-700 rounded text-blue-600 focus:ring-blue-500/50"
                                />
                                <label htmlFor="disclaimer" className="text-[11px] text-gray-200 leading-relaxed cursor-pointer select-none">
                                    <strong>Informational Purposes Only:</strong> This is not Financial Advice. Please understand your risk and do your own research. By continuing, you agree to the research disclaimer.
                                </label>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !code || !disclaimer}
                            className={`w-full font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg overflow-hidden relative group
                                ${loading || !code || !disclaimer
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-[0.98]'
                                }
                            `}
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    Enter Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}

                            {!loading && code && disclaimer && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            )}
                        </button>
                    </form>
                </div>

                <div className="px-8 py-4 bg-gray-800/50 border-t border-gray-800/50 text-center">
                    <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">
                        Access expires every 4 hours
                    </p>
                </div>
            </div>
        </div>
    );
}
