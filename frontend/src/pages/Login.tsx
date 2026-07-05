import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/api";

export function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setForgotMessage("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setForgotMessage(data.message);
    } catch (err) {
      setForgotMessage(apiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl mb-1 text-center">MR GRAIN</h1>
        <p className="text-center text-sm text-brown/60 mb-6">Business Command Centre</p>

        {!forgotMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-status-red-text">{error}</p>}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button type="button" className="text-xs text-brown/60 hover:underline w-full text-center" onClick={() => setForgotMode(true)}>
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {forgotMessage && <p className="text-sm text-brown">{forgotMessage}</p>}
            <button className="btn-primary w-full" type="submit">
              Send reset link
            </button>
            <button type="button" className="text-xs text-brown/60 hover:underline w-full text-center" onClick={() => setForgotMode(false)}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
