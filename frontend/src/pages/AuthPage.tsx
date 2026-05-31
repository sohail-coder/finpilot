import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { extractErrorMessage } from "../lib/api";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function AuthPage() {
  const { login, register, googleLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSuccess(credential: string) {
    try {
      setError("");
      setSubmitting(true);
      await googleLogin(credential);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isRegister && !agreedToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100">
      {/* Brand */}
      <h1 className="text-3xl font-extrabold italic text-indigo-600 mb-8">
        FinPilot
      </h1>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg px-10 py-10">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">
          {isRegister ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="text-sm text-center text-gray-500 mb-8">
          {isRegister
            ? "Start your journey with intelligent financial curation."
            : "Access your intelligent financial dashboard."}
        </p>

        {error && (
          <div className="mb-5 p-3 text-sm text-red-700 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* Google Button */}
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={(msg) => setError(msg)}
        />

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
            {isRegister ? "Or create account with email" : "Or login with email"}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Full Name"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="Email Address"
          />
          <div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Password"
            />
            {!isRegister && (
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  className="text-xs text-indigo-600 font-medium hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          {isRegister && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-500">
                I agree to the{" "}
                <span className="text-indigo-600 font-medium hover:underline cursor-pointer">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="text-indigo-600 font-medium hover:underline cursor-pointer">
                  Privacy Policy
                </span>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {submitting
              ? "Please wait..."
              : isRegister
                ? "Create Account"
                : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isRegister ? "Log In" : "Sign Up"}
          </button>
        </p>
      </div>

      {/* Footer links */}
      <div className="mt-10 flex items-center gap-6 text-xs text-gray-400">
        <span className="hover:text-gray-600 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-gray-600 cursor-pointer">Terms of Service</span>
        <span className="hover:text-gray-600 cursor-pointer">Contact Support</span>
      </div>
    </div>
  );
}
