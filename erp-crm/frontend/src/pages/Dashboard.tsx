import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Product, Challan } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [draftChallans, setDraftChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [low, custs, prods, drafts] = await Promise.all([
          api.get("/products?lowStock=true&limit=100"),
          api.get<{ meta: { total: number } }>("/customers?limit=1"),
          api.get<{ meta: { total: number } }>("/products?limit=1"),
          api.get("/challans?status=DRAFT&limit=5"),
        ]);
        setLowStock(low.data.data);
        setCustomerCount(custs.data.meta.total);
        setProductCount(prods.data.meta.total);
        setDraftChallans(drafts.data.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p className="subtitle">Role: {user?.role}</p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{customerCount}</span>
          <span className="stat-label">Customers</span>
          <Link to="/customers">View all →</Link>
        </div>
        <div className="stat-card">
          <span className="stat-value">{productCount}</span>
          <span className="stat-label">Products</span>
          <Link to="/products">View all →</Link>
        </div>
        <div className="stat-card warn">
          <span className="stat-value">{lowStock.length}</span>
          <span className="stat-label">Low stock alerts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{draftChallans.length}</span>
          <span className="stat-label">Draft challans</span>
          <Link to="/challans">View all →</Link>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="panel">
          <h2>Low stock products</h2>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Current stock</th>
                <th>Alert threshold</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td className="text-danger">{p.currentStock}</td>
                  <td>{p.minStockAlert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
