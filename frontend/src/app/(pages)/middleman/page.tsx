"use client";
import PackageQRCode from "@/app/components/PackageQRCode";
import { useState, useEffect } from "react";

type Batch = {
  id: number;
  batch_id: string;
  spice_name: string;
  quantity_kg: number;
  harvest_date: string;
  status: string;
  estimated_grade: string;
  farmer?: string;
  price_per_kg?: number;
  is_division?: boolean;
  parent_batch_id?: string;
};

type Transaction = {
  transaction_id: string;
  from_user: string;
  to_user: string;
  quantity_kg: number;
  total_amount: number;
  transaction_type: string;
  payment_status: string;
  transaction_date: string;
  direction: string;
  item_type: string;
  item_id: string;
  spice_name: string;
};

type Package = {
  id: number;
  package_id: string;
  spice_name: string;
  quantity_kg: number;
  package_type: string;
  status: string;
  package_date: string;
};

export default function MiddlemanPage() {
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>(
    []
  );
  const [myPackages, setMyPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Modal states
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // Form states
  const [sellForm, setSellForm] = useState({
    buyer_id: "",
    price_per_kg: "",
    notes: "",
  });
  const [packageForm, setPackageForm] = useState({
    quantity_kg: "",
    package_type: "retail",
  });
  const [buyForm, setBuyForm] = useState({
    price_per_kg: "",
    notes: "",
  });

  // API base URL
  const API_BASE = "http://127.0.0.1:5000/api";

  // Fetch data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchMyBatches(),
        // fetchAvailableBatches(),
        fetchPendingTransactions(),
        fetchMyPackages(),
      ]);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBatches = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/mybatches", {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setMyBatches(data.batches);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Error fetching my batches:", err);
    }
  };

  // const fetchAvailableBatches = async () => {
  //   try {
  //     const response = await fetch(
  //       `http://127.0.0.1:5000/api/search?type=batch&q=`,
  //       {
  //         credentials: "include",
  //       }
  //     );
  //     const data = await response.json();
  //     if (response.ok) {
  //       // Filter out batches already owned by current user
  //       const filtered =
  //         data.batches?.filter(
  //           (batch: any) =>
  //             !myBatches.some((mb) => mb.batch_id === batch.batch_id)
  //         ) || [];
  //       setAvailableBatches(filtered);
  //     }
  //   } catch (err) {
  //     console.error("Error fetching available batches:", err);
  //   }
  // };

  const fetchPendingTransactions = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/transactions`, {
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        // Filter for pending received transactions
        const pending = data.transactions.filter(
          (txn: Transaction) =>
            txn.direction === "received" && txn.payment_status === "pending"
        );
        setPendingTransactions(pending);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const fetchMyPackages = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/mypackages`, {
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setMyPackages(data.packages);
      }
    } catch (err) {
      console.error("Error fetching packages:", err);
    }
  };

  const handleSellBatch = async () => {
    if (!selectedBatch || !sellForm.buyer_id || !sellForm.price_per_kg) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/batch/${selectedBatch.id}/sell`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            buyer_id: parseInt(sellForm.buyer_id),
            price_per_kg: parseFloat(sellForm.price_per_kg),
            notes: sellForm.notes,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        alert(`Sale initiated! Transaction ID: ${data.transaction_id}`);
        setIsSellModalOpen(false);
        setSellForm({ buyer_id: "", price_per_kg: "", notes: "" });
        fetchMyBatches(); // Refresh data
      } else {
        alert(data.error || "Failed to initiate sale");
      }
    } catch (err) {
      alert("Error initiating sale");
      console.error(err);
    }
  };

  const [packageId, setPackageId] = useState("");

  const handleCreatePackage = async () => {
    if (!selectedBatch || !packageForm.quantity_kg) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/package`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          batch_id: selectedBatch.id,
          quantity_kg: parseFloat(packageForm.quantity_kg),
          package_type: packageForm.package_type,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Package created! ID: ${data.package_id}`);
        setPackageId(data.package_id);
        setIsPackageModalOpen(false);
        setPackageForm({ quantity_kg: "", package_type: "retail" });
        fetchMyBatches();
        fetchMyPackages();
      } else {
        alert(data.error || "Failed to create package");
      }
    } catch (err) {
      alert("Error creating package");
      console.error(err);
    }
  };

  const handleBuyBatch = async () => {
    if (!selectedBatch || !buyForm.price_per_kg) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          to_user_id: selectedBatch.id, // This should be the current user's ID
          batch_id: selectedBatch.id,
          quantity_kg: selectedBatch.quantity_kg,
          price_per_kg: parseFloat(buyForm.price_per_kg),
          transaction_type: "sale",
          notes: buyForm.notes,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Purchase initiated! Transaction ID: ${data.transaction_id}`);
        setIsBuyModalOpen(false);
        setBuyForm({ price_per_kg: "", notes: "" });
        // fetchAvailableBatches();
      } else {
        alert(data.error || "Failed to initiate purchase");
      }
    } catch (err) {
      alert("Error initiating purchase");
      console.error(err);
    }
  };

  const handleTransactionDecision = async (
    transactionId: string,
    decision: "accept" | "reject"
  ) => {
    try {
      if (decision === "accept") {
        const response = await fetch(
          `http://127.0.0.1:5000/api/transaction/${transactionId}/complete`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        const data = await response.json();
        if (response.ok) {
          alert("Transaction completed successfully!");
          fetchAllData(); // Refresh all data
        } else {
          alert(data.error || "Failed to complete transaction");
        }
      } else {
        // For rejection, we'd need a separate API endpoint
        alert("Transaction rejected");
        setPendingTransactions((prev) =>
          prev.filter((txn) => txn.transaction_id !== transactionId)
        );
      }
    } catch (err) {
      alert("Error processing transaction");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Middleman Dashboard
          </h1>
          <p className="text-slate-400">
            Manage your spice inventory and transactions
          </p>
        </div>

        {/* Pending Transactions Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">
            Pending Transactions for Verification
          </h2>
          {pendingTransactions.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending transactions.</p>
          ) : (
            <div className="space-y-4">
              {pendingTransactions.map((txn) => (
                <div
                  key={txn.transaction_id}
                  className="bg-slate-700 p-4 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">
                      {txn.spice_name} ({txn.quantity_kg}kg)
                    </p>
                    <p className="text-sm text-slate-400">
                      From: {txn.from_user} | Amount: ₹{txn.total_amount}
                    </p>
                    <p className="text-xs text-slate-500">
                      {txn.item_type}: {txn.item_id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleTransactionDecision(txn.transaction_id, "accept")
                      }
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        handleTransactionDecision(txn.transaction_id, "reject")
                      }
                      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Batches Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">My Batches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-700 text-sm">
                  <th className="p-2">Batch ID</th>
                  <th className="p-2">Spice</th>
                  <th className="p-2">Quantity (kg)</th>
                  <th className="p-2">Grade</th>
                  <th className="p-2">Harvest Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="border-b border-slate-700 text-sm"
                  >
                    <td className="p-2">{batch.batch_id}</td>
                    <td className="p-2">{batch.spice_name}</td>
                    <td className="p-2">{batch.quantity_kg}</td>
                    <td className="p-2">{batch.estimated_grade}</td>
                    <td className="p-2">
                      {new Date(batch.harvest_date).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          batch.status === "sold"
                            ? "bg-green-600"
                            : batch.status === "pending_sale"
                            ? "bg-yellow-600"
                            : "bg-blue-600"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedBatch(batch);
                            setIsSellModalOpen(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
                          disabled={
                            batch.status === "sold" ||
                            batch.status === "pending_sale"
                          }
                        >
                          Sell
                        </button>
                        <button
                          onClick={() => {
                            console.log("Packageing", batch);
                            setSelectedBatch(batch);
                            setIsPackageModalOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                          // disabled={batch.status === "sold"}
                        >
                          Package
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Available Batches to Buy */}
        {/* <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Available Batches to Buy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableBatches.map((batch) => (
              <div key={batch.batch_id} className="bg-slate-700 p-4 rounded-xl">
                <h3 className="font-semibold text-lg">{batch.spice_name}</h3>
                <p className="text-sm text-slate-300">ID: {batch.batch_id}</p>
                <p className="text-sm text-slate-300">
                  Quantity: {batch.quantity_kg}kg
                </p>
                <p className="text-sm text-slate-300">
                  Grade: {batch.estimated_grade}
                </p>
                {batch.farmer && (
                  <p className="text-sm text-slate-400">
                    Farmer: {batch.farmer}
                  </p>
                )}
                <button
                  onClick={() => {
                    setSelectedBatch(batch);
                    setIsBuyModalOpen(true);
                  }}
                  className="mt-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm w-full"
                >
                  Buy Now
                </button>
              </div>
            ))}
          </div>
        </div> */}

        {/* My Packages Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">My Packages</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-700 text-sm">
                  <th className="p-2">Package ID</th>
                  <th className="p-2">Spice</th>
                  <th className="p-2">Quantity (kg)</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {myPackages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-slate-700 text-sm"
                  >
                    <td className="p-2">{pkg.package_id}</td>
                    <td className="p-2">{pkg.spice_name}</td>
                    <td className="p-2">{pkg.quantity_kg}</td>
                    <td className="p-2">{pkg.package_type}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          pkg.status === "sold"
                            ? "bg-green-600"
                            : pkg.status === "shipped"
                            ? "bg-yellow-600"
                            : "bg-blue-600"
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </td>
                    <td className="p-2">
                      {new Date(pkg.package_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sell Modal */}
        {isSellModalOpen && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg w-96 border border-slate-600">
              <h3 className="text-lg font-bold mb-4">
                Sell Batch: {selectedBatch.spice_name}
              </h3>
              <div className="mb-3">
                <label className="block text-sm mb-1">Buyer User ID</label>
                <input
                  type="number"
                  value={sellForm.buyer_id}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, buyer_id: e.target.value })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                  placeholder="Enter buyer's user ID"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">Price per kg (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sellForm.price_per_kg}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, price_per_kg: e.target.value })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Notes (Optional)</label>
                <textarea
                  value={sellForm.notes}
                  onChange={(e) =>
                    setSellForm({ ...sellForm, notes: e.target.value })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsSellModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSellBatch}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
                >
                  Initiate Sale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Package Modal */}
        {isPackageModalOpen && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg w-96 border border-slate-600">
              <h3 className="text-lg font-bold mb-4">
                Create Package: {selectedBatch.spice_name}
              </h3>
              <div className="mb-3">
                <label className="block text-sm mb-1">Quantity (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  max={selectedBatch.quantity_kg}
                  value={packageForm.quantity_kg}
                  onChange={(e) =>
                    setPackageForm({
                      ...packageForm,
                      quantity_kg: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Available: {selectedBatch.quantity_kg}kg
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Package Type</label>
                <select
                  value={packageForm.package_type}
                  onChange={(e) =>
                    setPackageForm({
                      ...packageForm,
                      package_type: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                >
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="export">Export</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsPackageModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePackage}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm"
                >
                  Create Package
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Buy Modal */}
        {isBuyModalOpen && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg w-96 border border-slate-600">
              <h3 className="text-lg font-bold mb-4">
                Buy Batch: {selectedBatch.spice_name}
              </h3>
              <div className="mb-3 text-sm text-slate-300">
                <p>Quantity: {selectedBatch.quantity_kg}kg</p>
                <p>Grade: {selectedBatch.estimated_grade}</p>
                {selectedBatch.farmer && <p>Farmer: {selectedBatch.farmer}</p>}
              </div>
              <div className="mb-3">
                <label className="block text-sm mb-1">
                  Offer Price per kg (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={buyForm.price_per_kg}
                  onChange={(e) =>
                    setBuyForm({ ...buyForm, price_per_kg: e.target.value })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-1">Notes (Optional)</label>
                <textarea
                  value={buyForm.notes}
                  onChange={(e) =>
                    setBuyForm({ ...buyForm, notes: e.target.value })
                  }
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                  rows={3}
                />
              </div>
              {buyForm.price_per_kg && (
                <div className="mb-4 p-3 bg-slate-700 rounded">
                  <p className="text-sm font-semibold">
                    Total Amount: ₹
                    {(
                      parseFloat(buyForm.price_per_kg) *
                      selectedBatch.quantity_kg
                    ).toFixed(2)}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsBuyModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuyBatch}
                  className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm"
                >
                  Send Purchase Offer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {packageId && (
        <div className="mt-6">
          <PackageQRCode packageId={packageId} size={256} />
        </div>
      )}
    </div>
  );
}
