import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Customer, Product } from "../types";

interface LineItem {
  productId: string;
  quantity: string;
}

export function NewChallan() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: "1" }]);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [custRes, prodRes] = await Promise.all([api.get("/customers?limit=100"), api.get("/products?limit=100")]);
      setCustomers(custRes.data.data);
      setProducts(prodRes.data.data);
    }
    load();
  }, []);

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: "", quantity: "1" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function productStock(productId: string) {
    return products.find((p) => p.id === productId)?.currentStock;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((it) => it.productId && it.quantity);
    if (!customerId || validItems.length === 0) {
      setError("Select a customer and at least one product line item.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/challans", {
        customerId,
        status: saveAsDraft ? "DRAFT" : "CONFIRMED",
        items: validItems.map((it) => ({ productId: it.productId, quantity: parseInt(it.quantity, 10) })),
      });
      navigate(`/challans/${res.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create challan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/challans" className="back-link">
        ← Back to challans
      </Link>
      <h1>New Sales Challan</h1>

      <form className="panel challan-form" onSubmit={handleSubmit}>
        <label>
          Customer *
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.businessName ? `(${c.businessName})` : ""}
              </option>
            ))}
          </select>
        </label>

        <h3>Products</h3>
        {items.map((item, i) => (
          <div className="line-item-row" key={i}>
            <select required value={item.productId} onChange={(e) => updateItem(i, "productId", e.target.value)}>
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.sku} (stock: {p.currentStock})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              required
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(i, "quantity", e.target.value)}
            />
            {item.productId && Number(item.quantity) > (productStock(item.productId) ?? 0) && (
              <span className="text-danger inline-warning">Exceeds available stock ({productStock(item.productId)})</span>
            )}
            {items.length > 1 && (
              <button type="button" className="btn-ghost" onClick={() => removeItem(i)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={addItem}>
          + Add another product
        </button>

        <label className="checkbox-label" style={{ marginTop: "1rem" }}>
          <input type="checkbox" checked={saveAsDraft} onChange={(e) => setSaveAsDraft(e.target.checked)} />
          Save as Draft (uncheck to confirm immediately and deduct stock now)
        </label>

        {error && <div className="error-banner">{error}</div>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : saveAsDraft ? "Save Draft" : "Save & Confirm"}
        </button>
      </form>
    </div>
  );
}
