import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Challan } from "../types";
import { useAuth } from "../context/AuthContext";

export function ChallanDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canAct = user?.role === "ADMIN" || user?.role === "SALES";

  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get(`/challans/${id}`);
    setChallan(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleConfirm() {
    setActing(true);
    setActionError(null);
    try {
      await api.patch(`/challans/${id}/confirm`);
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to confirm challan");
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this challan? If it was confirmed, stock will be restored.")) return;
    setActing(true);
    setActionError(null);
    try {
      await api.patch(`/challans/${id}/cancel`);
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || "Failed to cancel challan");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!challan) return <div>Challan not found.</div>;

  return (
    <div>
      <Link to="/challans" className="back-link">
        ← Back to challans
      </Link>
      <div className="page-header">
        <h1>{challan.challanNumber}</h1>
        <span className={`badge badge-${challan.status.toLowerCase()}`}>{challan.status}</span>
      </div>

      <div className="panel">
        <h2>Customer</h2>
        <p>
          <Link to={`/customers/${challan.customerId}`}>{challan.customer?.name}</Link>
          {challan.customer?.businessName ? ` — ${challan.customer.businessName}` : ""}
        </p>
      </div>

      <div className="panel">
        <h2>Line items</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Unit price (at time of sale)</th>
              <th>Quantity</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {challan.items.map((it) => (
              <tr key={it.id}>
                <td>{it.productNameSnapshot}</td>
                <td>{it.productSkuSnapshot}</td>
                <td>₹{Number(it.unitPriceSnapshot).toFixed(2)}</td>
                <td>{it.quantity}</td>
                <td>₹{(Number(it.unitPriceSnapshot) * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="total-line">
          Total quantity: <strong>{challan.totalQuantity}</strong>
        </p>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      {canAct && challan.status === "DRAFT" && (
        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleCancel} disabled={acting}>
            Cancel Challan
          </button>
          <button className="btn-primary" onClick={handleConfirm} disabled={acting}>
            {acting ? "Confirming..." : "Confirm & Deduct Stock"}
          </button>
        </div>
      )}
      {canAct && challan.status === "CONFIRMED" && (
        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleCancel} disabled={acting}>
            Cancel Challan (restores stock)
          </button>
        </div>
      )}
    </div>
  );
}
