import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@erp.com");
  const [password, setPassword] = useState("Password@123");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch {
      // error is surfaced via context state
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>ERP + CRM Portal</h1>
        <p className="subtitle">Sign in to continue</p>

        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        <div className="hint-box">
          <strong>Test accounts</strong> (password: Password@123)
          <ul>
            <li>admin@erp.com — Admin</li>
            <li>sales@erp.com — Sales</li>
            <li>warehouse@erp.com — Warehouse</li>
            <li>accounts@erp.com — Accounts</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
