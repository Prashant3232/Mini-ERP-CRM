import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Product, MovementType } from "../types";
import { useAuth } from "../context/AuthContext";

export function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "WAREHOUSE";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [movementType, setMovementType] = useState<MovementType>("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get(`/products/${id}`);
    setProduct(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleMovement(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/products/${id}/stock-movement`, {
        quantity: parseInt(quantity, 10),
        movementType,
        reason: reason || undefined,
      });
      setQuantity("");
      setReason("");
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to record stock movement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!product) return <div>Product not found.</div>;

  return (
    <div>
      <Link to="/products" className="back-link">
        ← Back to products
      </Link>
      <div className="page-header">
        <h1>{product.name}</h1>
        <span className={product.currentStock <= product.minStockAlert ? "badge badge-inactive" : "badge badge-active"}>
          Stock: {product.currentStock}
        </span>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <h2>Details</h2>
          <dl>
            <dt>SKU</dt>
            <dd>{product.sku}</dd>
            <dt>Category</dt>
            <dd>{product.category || "—"}</dd>
            <dt>Unit price</dt>
            <dd>₹{Number(product.unitPrice).toFixed(2)}</dd>
            <dt>Min stock alert</dt>
            <dd>{product.minStockAlert}</dd>
            <dt>Location</dt>
            <dd>{product.location || "—"}</dd>
          </dl>
        </div>

        {canEdit && (
          <div className="panel">
            <h2>Record stock movement</h2>
            <form className="stock-form" onSubmit={handleMovement}>
              <label>
                Type
                <select value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)}>
                  <option value="IN">Stock IN</option>
                  <option value="OUT">Stock OUT</option>
                </select>
              </label>
              <label>
                Quantity
                <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <label>
                Reason
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Purchase order, damage, correction" />
              </label>
              {error && <div className="error-banner">{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Record movement"}
              </button>
            </form>
          </div>
        )}

        <div className="panel span-2">
          <h2>Stock movement log</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {product.stockMovements?.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={m.movementType === "IN" ? "badge badge-active" : "badge badge-inactive"}>{m.movementType}</span>
                  </td>
                  <td>{m.quantity}</td>
                  <td>{m.reason || "—"}</td>
                  <td>{m.createdBy?.name || "—"}</td>
                </tr>
              ))}
              {(!product.stockMovements || product.stockMovements.length === 0) && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No movements recorded yet.
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
