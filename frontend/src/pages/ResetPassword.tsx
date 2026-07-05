import { FormEvent, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setMessage(data.message);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl mb-6 text-center">Reset Password</h1>
        {message ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-ink">{message}</p>
            <Link to="/login" className="btn-primary inline-flex">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-status-red-text">{error}</p>}
            <button className="btn-primary w-full" type="submit">Reset password</button>
          </form>
        )}
      </div>
    </div>
  );
}
