// app/farmer/page.tsx
"use client";
import { useState, useEffect } from "react";

// TypeScript interfaces
interface Batch {
  id: number;
  batch_id: string;
  spice_name: string;
  quantity_kg: number;
  harvest_date: string;
  status: string;
  estimated_grade?: string;
  is_division: boolean;
  parent_batch_id?: string;
  division_info?: string;
}

interface DashboardData {
  user_type: string;
  summary: {
    total_batches: number;
    active_batches: number;
    recent_transactions: number;
  };
}

interface Spice {
  id: number;
  name: string;
  scientific_name?: string;
  category?: string;
  origin_region?: string;
}

interface User {
  id: number;
  username: string;
  user_type: string;
}

interface SaleItem {
  batchId: string;
  buyerId: string;
  pricePerKg: string;
}

interface DivisionItem {
  quantity_kg: number;
  buyer_id?: string;
  price_per_kg?: number;
}

export default function FarmerPage() {
  // State management
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]); // For owned batches (not just available)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [spices, setSpices] = useState<Spice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [activeTab, setActiveTab] = useState<
    "overview" | "register" | "sell" | "divide"
  >("overview");
  const [newBatch, setNewBatch] = useState({
    spice_id: "",
    quantity_kg: "",
    farm_location: "",
    farming_method: "conventional",
    estimated_grade: "B",
  });
  const [saleItems, setSaleItems] = useState<SaleItem[]>([
    { batchId: "", buyerId: "", pricePerKg: "" },
  ]);
  const [divisionBatchId, setDivisionBatchId] = useState("");
  const [divisions, setDivisions] = useState<DivisionItem[]>([
    { quantity_kg: 0 },
  ]);

  // API Functions
  const fetchBatches = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/mybatches/available",
        {
          method: "GET",
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setBatches(data.available_batches);
      }
    } catch (error) {
      console.error("Error fetching available batches:", error);
    }
  };

  const fetchAllBatches = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/mybatches", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAllBatches(data.batches);
      }
    } catch (error) {
      console.error("Error fetching all batches:", error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/dashboard", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    }
  };

  const fetchSpices = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/spices", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSpices(data.spices);
      }
    } catch (error) {
      console.error("Error fetching spices:", error);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) return;
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/search?q=${query}&type=user`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchBatches(),
        fetchAllBatches(),
        fetchDashboard(),
        fetchSpices(),
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Form handlers
  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:5000/api/registerbatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newBatch,
          spice_id: Number(newBatch.spice_id),
          quantity_kg: Number(newBatch.quantity_kg),
          harvest_date: new Date().toISOString(),
        }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Batch registered successfully! Batch ID: ${data.batch_id}`);
        setNewBatch({
          spice_id: "",
          quantity_kg: "",
          farm_location: "",
          farming_method: "conventional",
          estimated_grade: "B",
        });
        await Promise.all([
          fetchBatches(),
          fetchAllBatches(),
          fetchDashboard(),
        ]);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to register batch");
    }
  };

  const handleSellBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      for (const item of saleItems) {
        if (!item.batchId || !item.buyerId || !item.pricePerKg) continue;

        const response = await fetch(
          `http://127.0.0.1:5000/api/batch/${item.batchId}/sell`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buyer_id: Number(item.buyerId),
              price_per_kg: Number(item.pricePerKg),
            }),
            credentials: "include",
          }
        );

        if (!response.ok) {
          const error = await response.json();
          alert(`Error selling batch ${item.batchId}: ${error.error}`);
          return;
        }
      }

      alert("Sale transactions initiated successfully!");
      setSaleItems([{ batchId: "", buyerId: "", pricePerKg: "" }]);
      await Promise.all([fetchBatches(), fetchAllBatches()]);
    } catch (error) {
      alert("Failed to initiate sales");
    }
  };

  const handleDivideBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("http://127.0.0.1:5000/api/batch/divide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: Number(divisionBatchId),
          divisions: divisions.filter((d) => d.quantity_kg > 0),
        }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        alert(
          `Batch divided successfully! Created ${data.summary.total_divisions} divisions`
        );
        setDivisionBatchId("");
        setDivisions([{ quantity_kg: 0 }]);
        await Promise.all([fetchBatches(), fetchAllBatches()]);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert("Failed to divide batch");
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      harvested: "bg-yellow-600",
      tested: "bg-blue-600",
      divided: "bg-purple-600",
      packaged: "bg-green-600",
      sold: "bg-gray-600",
      pending_sale: "bg-orange-600",
    };
    return colors[status as keyof typeof colors] || "bg-gray-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
        <div className="text-xl">Loading farmer dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Farmer Dashboard</h1>

        {/* Dashboard Summary */}
        {dashboardData && (
          <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700 mb-8">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-700 p-4 rounded-lg text-center">
                <h3 className="text-sm text-gray-300">Total Batches</h3>
                <p className="text-3xl font-bold text-blue-400">
                  {dashboardData.summary.total_batches}
                </p>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg text-center">
                <h3 className="text-sm text-gray-300">Active Batches</h3>
                <p className="text-3xl font-bold text-green-400">
                  {dashboardData.summary.active_batches}
                </p>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg text-center">
                <h3 className="text-sm text-gray-300">Recent Transactions</h3>
                <p className="text-3xl font-bold text-orange-400">
                  {dashboardData.summary.recent_transactions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-800 rounded-t-2xl border border-slate-700 border-b-0">
          <div className="flex flex-wrap border-b border-slate-700">
            {[
              { id: "overview", label: "My Batches", count: allBatches.length },
              { id: "register", label: "Register Batch" },
              { id: "sell", label: "Sell Batches" },
              { id: "divide", label: "Divide Batch" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-700 text-white border-b-2 border-orange-500"
                    : "text-gray-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {tab.label} {tab.count !== undefined && `(${tab.count})`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-b-2xl border border-slate-700 border-t-0 p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">All My Batches</h2>
                <div className="text-sm text-gray-400">
                  Available for sale: {batches.length} | Total owned:{" "}
                  {allBatches.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-700 text-sm">
                      <th className="p-3">Batch ID</th>
                      <th className="p-3">Spice</th>
                      <th className="p-3">Quantity (kg)</th>
                      <th className="p-3">Harvest Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Grade</th>
                      <th className="p-3">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="border-b border-slate-700 hover:bg-slate-750"
                      >
                        <td className="p-3 font-mono text-sm">
                          {batch.batch_id}
                        </td>
                        <td className="p-3">{batch.spice_name}</td>
                        <td className="p-3">{batch.quantity_kg}</td>
                        <td className="p-3">
                          {new Date(batch.harvest_date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs capitalize ${getStatusColor(
                              batch.status
                            )}`}
                          >
                            {batch.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3">
                          {batch.estimated_grade || "N/A"}
                        </td>
                        <td className="p-3">
                          {batch.is_division ? (
                            <div>
                              <span className="text-purple-400 text-xs">
                                Division
                              </span>
                              {batch.division_info && (
                                <div className="text-xs text-gray-400">
                                  {batch.division_info}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-green-400 text-xs">
                              Original
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {allBatches.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No batches found. Register your first batch using the
                    Register Batch tab.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Register Batch Tab */}
          {activeTab === "register" && (
            <div>
              <h2 className="text-xl font-bold mb-6">Register New Batch</h2>
              <form onSubmit={handleRegisterBatch} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Spice
                    </label>
                    <select
                      value={newBatch.spice_id}
                      onChange={(e) =>
                        setNewBatch({ ...newBatch, spice_id: e.target.value })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select Spice</option>
                      {spices.map((spice) => (
                        <option key={spice.id} value={spice.id}>
                          {spice.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Quantity (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newBatch.quantity_kg}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          quantity_kg: e.target.value,
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Farm Location
                    </label>
                    <input
                      type="text"
                      value={newBatch.farm_location}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          farm_location: e.target.value,
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Farming Method
                    </label>
                    <select
                      value={newBatch.farming_method}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          farming_method: e.target.value,
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    >
                      <option value="conventional">Conventional</option>
                      <option value="organic">Organic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Estimated Grade
                    </label>
                    <select
                      value={newBatch.estimated_grade}
                      onChange={(e) =>
                        setNewBatch({
                          ...newBatch,
                          estimated_grade: e.target.value,
                        })
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    >
                      <option value="A">Grade A</option>
                      <option value="B">Grade B</option>
                      <option value="C">Grade C</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                >
                  Register Batch
                </button>
              </form>
            </div>
          )}

          {/* Sell Batches Tab */}
          {activeTab === "sell" && (
            <div>
              <h2 className="text-xl font-bold mb-6">Sell Batches</h2>
              <form onSubmit={handleSellBatch} className="space-y-6">
                {saleItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-slate-700 p-4 rounded-lg space-y-4"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Sale Item {index + 1}</h3>
                      {saleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSaleItems(
                              saleItems.filter((_, i) => i !== index)
                            )
                          }
                          className="text-red-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block mb-1 text-sm">Batch</label>
                        <select
                          value={item.batchId}
                          onChange={(e) => {
                            const newItems = [...saleItems];
                            newItems[index].batchId = e.target.value;
                            setSaleItems(newItems);
                          }}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                          required
                        >
                          <option value="">Select Batch</option>
                          {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batch_id} - {batch.spice_name} (
                              {batch.quantity_kg}kg)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block mb-1 text-sm">Buyer ID</label>
                        <input
                          type="number"
                          value={item.buyerId}
                          onChange={(e) => {
                            const newItems = [...saleItems];
                            newItems[index].buyerId = e.target.value;
                            setSaleItems(newItems);
                          }}
                          placeholder="Enter buyer user ID"
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-sm">
                          Price per kg
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.pricePerKg}
                          onChange={(e) => {
                            const newItems = [...saleItems];
                            newItems[index].pricePerKg = e.target.value;
                            setSaleItems(newItems);
                          }}
                          placeholder="e.g., 150.00"
                          className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setSaleItems([
                        ...saleItems,
                        { batchId: "", buyerId: "", pricePerKg: "" },
                      ])
                    }
                    className="bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg"
                  >
                    Add Another Sale
                  </button>

                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg"
                  >
                    Initiate Sales
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Divide Batch Tab */}
          {activeTab === "divide" && (
            <div>
              <h2 className="text-xl font-bold mb-6">Divide Batch</h2>
              <form onSubmit={handleDivideBatch} className="space-y-6">
                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Select Batch to Divide
                  </label>
                  <select
                    value={divisionBatchId}
                    onChange={(e) => setDivisionBatchId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select Batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batch_id} - {batch.spice_name} (
                        {batch.quantity_kg}kg available)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Divisions</h3>
                  {divisions.map((division, index) => (
                    <div
                      key={index}
                      className="bg-slate-700 p-4 rounded-lg space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Division {index + 1}</h4>
                        {divisions.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDivisions(
                                divisions.filter((_, i) => i !== index)
                              )
                            }
                            className="text-red-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block mb-1 text-sm">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={division.quantity_kg}
                            onChange={(e) => {
                              const newDivisions = [...divisions];
                              newDivisions[index].quantity_kg = Number(
                                e.target.value
                              );
                              setDivisions(newDivisions);
                            }}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label className="block mb-1 text-sm">
                            Buyer ID (Optional)
                          </label>
                          <input
                            type="number"
                            value={division.buyer_id || ""}
                            onChange={(e) => {
                              const newDivisions = [...divisions];
                              newDivisions[index].buyer_id = e.target.value
                                ? e.target.value
                                : undefined;
                              setDivisions(newDivisions);
                            }}
                            placeholder="Leave empty to keep"
                            className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block mb-1 text-sm">
                            Price per kg (if selling)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={division.price_per_kg || ""}
                            onChange={(e) => {
                              const newDivisions = [...divisions];
                              newDivisions[index].price_per_kg = e.target.value
                                ? Number(e.target.value)
                                : undefined;
                              setDivisions(newDivisions);
                            }}
                            placeholder="Required if buyer specified"
                            className="w-full bg-slate-600 border border-slate-500 rounded px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setDivisions([...divisions, { quantity_kg: 0 }])
                    }
                    className="bg-slate-600 hover:bg-slate-500 text-white py-2 px-4 rounded-lg"
                  >
                    Add Division
                  </button>

                  <button
                    type="submit"
                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-lg"
                  >
                    Divide Batch
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
