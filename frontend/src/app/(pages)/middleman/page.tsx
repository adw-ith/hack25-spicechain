// app/middleman/page.tsx
"use client";
import { useState } from "react";

type Batch = {
  id: string;
  spice: string;
  origin: string;
  owner: string;
  harvest_date: string;
  status: string;
  qty: string;
  subBatches?: SubBatch[];
};

type SubBatch = {
  id: string;
  qty: string;
  to: string;
  date: string;
};

export default function MiddlemanPage() {
  const currentUser = { id: "MID001", name: "Middleman X" };

  // Dummy batches sent to this middleman (pending verification)
  const [pendingBatches, setPendingBatches] = useState([
    {
      id: "BATCH004",
      spice: "Black Pepper",
      origin: "Kerala",
      from: "Farmer A",
      qty: "30kg",
      status: "Verify Pending",
    },
    {
      id: "BATCH005",
      spice: "Cardamom",
      origin: "Tamil Nadu",
      from: "Farmer B",
      qty: "15kg",
      status: "Verify Pending",
    },
  ]);

  // Dummy batch list already owned by middleman
  const [myBatches, setMyBatches] = useState<Batch[]>([
    {
      id: "BATCH001",
      spice: "Black Pepper",
      origin: "Kerala",
      owner: "Middleman X",
      harvest_date: "2025-08-10",
      status: "In Transit",
      qty: "50kg",
      subBatches: [],
    },
    {
      id: "BATCH006",
      spice: "Turmeric",
      origin: "Andhra Pradesh",
      owner: "Middleman X",
      harvest_date: "2025-08-15",
      status: "With Middleman",
      qty: "70kg",
      subBatches: [],
    },
  ]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [sendQty, setSendQty] = useState("");
  const [sendTo, setSendTo] = useState("");

  // Handle accept/reject
  const handleDecision = (id: string, decision: "accept" | "reject") => {
    const batch = pendingBatches.find((b) => b.id === id);
    if (!batch) return;

    if (decision === "accept") {
      setMyBatches((prev) => [
        ...prev,
        {
          ...batch,
          owner: currentUser.name,
          harvest_date: new Date().toISOString().split("T")[0],
          status: "With Middleman",
          subBatches: [],
        },
      ]);
    }
    setPendingBatches((prev) => prev.filter((b) => b.id !== id));
  };

  // Open send modal
  const openSendModal = (batch: Batch) => {
    setSelectedBatch(batch);
    setSendQty("");
    setSendTo("");
    setIsModalOpen(true);
  };

  // Handle sending subbatch
  const handleSendForward = () => {
    if (!selectedBatch || !sendQty || !sendTo) return;

    const qtyNum = parseFloat(sendQty);
    const currentQty = parseFloat(selectedBatch.qty.replace("kg", ""));

    if (qtyNum > currentQty) {
      alert("Quantity exceeds available stock");
      return;
    }

    const newSub: SubBatch = {
      id: `${selectedBatch.id}-SUB${
        (selectedBatch.subBatches?.length || 0) + 1
      }`,
      qty: qtyNum + "kg",
      to: sendTo,
      date: new Date().toISOString().split("T")[0],
    };

    setMyBatches((prev) =>
      prev.map((b) =>
        b.id === selectedBatch.id
          ? {
              ...b,
              qty: currentQty - qtyNum + "kg", // ✅ update remaining qty
              subBatches: [...(b.subBatches || []), newSub],
            }
          : b
      )
    );

    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Notifications Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">
            Pending Batches for Verification
          </h2>
          {pendingBatches.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending batches.</p>
          ) : (
            <div className="space-y-4">
              {pendingBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="bg-slate-700 p-4 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">
                      {batch.spice} ({batch.qty})
                    </p>
                    <p className="text-sm text-slate-400">
                      From: {batch.from} | Origin: {batch.origin}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(batch.id, "accept")}
                      className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecision(batch.id, "reject")}
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
                  <th className="p-2">Origin</th>
                  <th className="p-2">Owner</th>
                  <th className="p-2">Harvest Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {myBatches.map((b) => (
                  <>
                    <tr
                      key={b.id}
                      className="border-b border-slate-700 text-sm"
                    >
                      <td className="p-2">{b.id}</td>
                      <td className="p-2">{b.spice}</td>
                      <td className="p-2">{b.origin}</td>
                      <td className="p-2">{b.owner}</td>
                      <td className="p-2">{b.harvest_date}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            b.status === "Delivered"
                              ? "bg-green-600"
                              : b.status === "In Transit"
                              ? "bg-yellow-600"
                              : "bg-blue-600"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-2">{b.qty}</td>
                      <td className="p-2">
                        <button
                          onClick={() => openSendModal(b)}
                          className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg text-xs"
                        >
                          Send Forward
                        </button>
                      </td>
                    </tr>

                    {/* SubBatches display */}
                    {b.subBatches && b.subBatches.length > 0 && (
                      <tr>
                        <td colSpan={8} className="bg-slate-900 p-2">
                          <div className="ml-6">
                            <h4 className="text-sm font-semibold mb-2">
                              Sub-Batches Sent
                            </h4>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-700">
                                  <th className="p-2">SubBatch ID</th>
                                  <th className="p-2">Qty</th>
                                  <th className="p-2">Sent To</th>
                                  <th className="p-2">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.subBatches.map(
                                  (sub: SubBatch, idx: number) => (
                                    <tr
                                      key={idx}
                                      className="border-b border-slate-700"
                                    >
                                      <td className="p-2">{sub.id}</td>
                                      <td className="p-2">{sub.qty}</td>
                                      <td className="p-2">{sub.to}</td>
                                      <td className="p-2">{sub.date}</td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Send Forward Modal */}
        {isModalOpen && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-lg w-96 border border-slate-600">
              <h3 className="text-lg font-bold mb-4">
                Send Forward: {selectedBatch.spice}
              </h3>

              <div className="mb-3">
                <label className="block text-sm mb-1">Quantity (kg)</label>
                <input
                  type="number"
                  value={sendQty}
                  onChange={(e) => setSendQty(e.target.value)}
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1">Send To</label>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="Middleman Y / Consumer"
                  className="w-full p-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendForward}
                  className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
