// app/farmer/page.tsx
"use client";
import { useState } from "react";

export default function FarmerPage() {
  const [spiceId, setSpiceId] = useState("");
  const [originLocation, setOriginLocation] = useState("");
  const [originParticipant, setOriginParticipant] = useState("");
  const [initialQty, setInitialQty] = useState("");

  // Dummy dropdown data
  const spices = [
    { id: "SP001", name: "Black Pepper" },
    { id: "SP002", name: "Cardamom" },
    { id: "SP003", name: "Turmeric" },
  ];

  const participants = [
    { id: "P001", name: "Farmer A" },
    { id: "P002", name: "Farmer B" },
    { id: "P003", name: "Farmer C" },
  ];

  const currentUser = { id: "OWN001", name: "Farmer A" };

  // Dummy batch list
  const batches = [
    {
      id: "BATCH001",
      spice: "Black Pepper",
      origin: "Kerala",
      owner: "Middleman X",
      harvest_date: "2025-08-10",
      status: "In Transit",
      qty: "50kg",
    },
    {
      id: "BATCH002",
      spice: "Cardamom",
      origin: "Tamil Nadu",
      owner: "Consumer Y",
      harvest_date: "2025-07-22",
      status: "Delivered",
      qty: "20kg",
    },
    {
      id: "BATCH003",
      spice: "Turmeric",
      origin: "Andhra Pradesh",
      owner: "Farmer A",
      harvest_date: "2025-08-01",
      status: "With Farmer",
      qty: "100kg",
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(
      `Submitted Batch: ${spiceId}, ${originLocation}, ${originParticipant}, ${initialQty}`
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Form Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Sell Your Spice</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Spice Dropdown */}
            <div>
              <label className="block mb-1">Spice</label>
              <select
                value={spiceId}
                onChange={(e) => setSpiceId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2"
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

            {/* Location */}
            <div>
              <label className="block mb-1">Origin Location</label>
              <input
                type="text"
                value={originLocation}
                onChange={(e) => setOriginLocation(e.target.value)}
                placeholder="Enter location (e.g., Kerala)"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2"
                required
              />
            </div>

            {/* Participant Dropdown */}
            <div>
              <label className="block mb-1">Origin Participant</label>
              <select
                value={originParticipant}
                onChange={(e) => setOriginParticipant(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2"
                required
              >
                <option value="">Select Participant</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block mb-1">Initial Quantity (grams)</label>
              <input
                type="number"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2"
                required
              />
            </div>

            {/* Owner Auto-filled */}
            <div>
              <label className="block mb-1">Current Owner</label>
              <input
                type="text"
                value={currentUser.name}
                disabled
                className="w-full bg-slate-700 text-slate-300 rounded-lg px-3 py-2 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-all"
            >
              Submit
            </button>
          </form>
        </div>

        {/* Batch List Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Your Batches</h2>
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
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-700 text-sm">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
