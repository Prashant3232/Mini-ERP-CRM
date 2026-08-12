import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Challan } from "../types";
import { useAuth } from "../context/AuthContext";

export function Challans() {
  const { user } = useAuth();
  const canCreate = user?.role === "ADMIN" || user?.role === "SALES";

  const [challans, setChallans] = useState<Challan[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const res = await api.get(`/challans?${params.toString()}`);
    setChallans(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="page-header">
        <h1>Sales Challans</h1>
        {canCreate && (
          <Link to="/challans/new" className="btn-primary">
            + New Challan
          </Link>
        )}
      </div>

      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Challan #</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total qty</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {challans.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/challans/${c.id}`}>{c.challanNumber}</Link>
                </td>
                <td>{c.customer?.name}</td>
                <td>{c.items.length}</td>
                <td>{c.totalQuantity}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {challans.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No challans found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
