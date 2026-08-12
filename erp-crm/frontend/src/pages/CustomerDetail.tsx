import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Customer } from "../types";
import { useAuth } from "../context/AuthContext";

export function CustomerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SALES";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    const res = await api.get(`/customers/${id}`);
    setCustomer(res.data.data);
    setStatus(res.data.data.status);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/customers/${id}/notes`, { note: newNote });
      setNewNote("");
      load();
    } finally {
      setAddingNote(false);
    }
  }

  async function handleStatusSave() {
    await api.put(`/customers/${id}`, { status });
    setEditing(false);
    load();
  }

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!customer) return <div>Customer not found.</div>;

  return (
    <div>
      <Link to="/customers" className="back-link">
        ← Back to customers
      </Link>
      <div className="page-header">
        <h1>{customer.name}</h1>
        {editing ? (
          <div className="inline-edit">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="LEAD">Lead</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button className="btn-primary" onClick={handleStatusSave}>
              Save
            </button>
          </div>
        ) : (
          <span className={`badge badge-${customer.status.toLowerCase()}`}>{customer.status}</span>
        )}
      </div>

      <div className="detail-grid">
        <div className="panel">
          <h2>
            Details {canEdit && !editing && <button className="link-btn" onClick={() => setEditing(true)}>Edit status</button>}
          </h2>
          <dl>
            <dt>Business</dt>
            <dd>{customer.businessName || "—"}</dd>
            <dt>Mobile</dt>
            <dd>{customer.mobile}</dd>
            <dt>Email</dt>
            <dd>{customer.email || "—"}</dd>
            <dt>GST number</dt>
            <dd>{customer.gstNumber || "—"}</dd>
            <dt>Type</dt>
            <dd>{customer.customerType}</dd>
            <dt>Address</dt>
            <dd>{customer.address || "—"}</dd>
            <dt>Follow-up date</dt>
            <dd>{customer.followUpDate ? new Date(customer.followUpDate).toLocaleDateString() : "—"}</dd>
          </dl>
        </div>

        <div className="panel">
          <h2>Follow-up notes</h2>
          {canEdit && (
            <form className="note-form" onSubmit={handleAddNote}>
              <textarea placeholder="Add a follow-up note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} />
              <button className="btn-primary" type="submit" disabled={addingNote}>
                Add note
              </button>
            </form>
          )}
          <ul className="note-list">
            {customer.followUpNotes?.map((n) => (
              <li key={n.id}>
                <p>{n.note}</p>
                <span className="note-meta">
                  {n.createdBy?.name || "Unknown"} · {new Date(n.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {(!customer.followUpNotes || customer.followUpNotes.length === 0) && <li className="empty-row">No notes yet.</li>}
          </ul>
        </div>

        <div className="panel span-2">
          <h2>Recent challans</h2>
          <table>
            <thead>
              <tr>
                <th>Challan #</th>
                <th>Status</th>
                <th>Total qty</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {customer.challans?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/challans/${c.id}`}>{c.challanNumber}</Link>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                  </td>
                  <td>{c.totalQuantity}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!customer.challans || customer.challans.length === 0) && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No challans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
