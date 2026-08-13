import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';

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
    <div className="relative flex min-h-screen items-center justify-center bg-[#100b07] p-4">
      {/* The shop's silk, held right back so the card stays the subject. */}
      <img
        src="/images/texture-gold-silk.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#100b07]/70 via-[#100b07]/85 to-[#100b07]" />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <Card className="border-0 bg-white shadow-2xl backdrop-blur-sm dark:bg-gray-900/95">
          <CardHeader className="space-y-4 text-center">
            {/* The shop's own logo rather than stock icons. The mark and the script are
                separate files so the name can be scaled up relative to the emblem — in the
                supplied lockup the script is only a fifth of the artwork's height and goes
                unreadable at this size. Explicit widths so the card cannot shift on load. */}
            <span className="mx-auto flex items-center justify-center gap-3">
              <img
                src="/images/logo-mark.png"
                alt=""
                aria-hidden="true"
                width={30}
                height={60}
                className="block h-[60px] w-[30px] object-contain"
              />
              <img
                src="/images/logo-wordmark.png"
                alt={businessSettings?.businessName || "Swetha's Couture"}
                width={222}
                height={40}
                className="block h-[40px] w-[222px] object-contain"
              />
            </span>
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
                  className="transition-all duration-200 focus:ring-2 focus:ring-[#c0903c]"
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
                    className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-[#c0903c]"
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
                className="w-full bg-[#c0903c] text-[#100b07] transition-all duration-300 hover:bg-[#d8b460]"
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
          className="flex items-center justify-center gap-2 text-sm text-[#f6efe3]/60 transition-colors hover:text-[#d8b460]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to swethacoutures.com
        </Link>
      </div>
    </div>
  );
};

export default Login;
