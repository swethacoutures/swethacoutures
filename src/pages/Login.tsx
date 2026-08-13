import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Crown, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';

/**
 * Staff sign-in, reachable at /admin (and /login, kept as an alias).
 *
 * This page used to offer one-click "Quick Login" buttons that filled in the owner's real
 * email and password, and a "Create Admin User" button that would mint an admin account
 * with a guessable password. Both were removed: anyone who found the URL had the keys to
 * the whole business — every bill, every customer, every rupee of revenue. There is no
 * self-service path to an account here by design. Accounts are created from the Employees
 * page by someone already signed in as an admin.
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      // `login` already reports the failure as a toast; nothing to add here.
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Card className="border-0 bg-white shadow-2xl backdrop-blur-sm dark:bg-gray-900/95">
          <CardHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center space-x-3">
              <Crown className="h-8 w-8 text-purple-600" />
              <Scissors className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-3xl font-bold text-transparent">
              {businessSettings?.businessName || 'Business Management'}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Staff sign-in — authorised users only
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="username"
                  className="transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 transition-colors hover:text-gray-800 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300 hover:from-purple-700 hover:to-blue-700"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                Accounts are issued by the shop owner from the Employees page. If you cannot
                get in, ask an admin to reset your password — there is no self-service reset
                or sign-up here.
              </p>
            </div>
          </CardContent>
        </Card>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to swethacoutures.com
        </Link>
      </div>
    </div>
  );
};

export default Login;
