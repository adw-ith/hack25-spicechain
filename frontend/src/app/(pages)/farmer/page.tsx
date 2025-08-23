// app/farmer/page.tsx
"use client";
import { useState, useEffect } from "react";

// Define TypeScript interfaces for better type safety
interface Batch {
  id: string;
  spice: string;
  origin: string;
  owner: string;
  harvest_date: string;
  status: string;
  qty: string;
}

interface Spice {
  id: number;
  name: string;
}

interface Participant {
  id: number;
  name: string;
  role: string;
}

// Define the structure for an item in a new transaction
interface TransactionItem {
  sourceBatchId: string;
  recipientId: string;
  quantity: string;
  type: "middleman_transfer" | "consumer_package";
}

// Boilerplate user data - this would normally come from an auth context
const currentUser = { id: 1, name: "Farmer A", role: "farmer" };

// Sample Data (replace with API calls in production)
const sampleBatches = [
  {
    "id": "B-9c02b378-f71c-4b5d-9a9e-f0b4d4b1a41a",
    "spice": "Black Pepper",
    "origin": "Idukki, Kerala",
    "owner": "Farmer A",
    "harvest_date": "2025-08-20",
    "status": "In Stock",
    "qty": "50000g"
  },
  {
    "id": "B-a8e5f7c3-2d1b-4b2a-8c7e-e1f0a2d3c4b5",
    "spice": "Cardamom",
    "origin": "Vandanmedu, Kerala",
    "owner": "Farmer A",
    "harvest_date": "2025-08-15",
    "status": "In Stock",
    "qty": "25000g"
  }
];

const sampleSpices = [
  { "id": 1, "name": "Black Pepper" },
  { "id": 2, "name": "Cardamom" },
  { "id": 3, "name": "Turmeric" }
];

const sampleParticipants = [
  { "id": 2, "name": "Ajay Traders", "role": "Middleman" },
  { "id": 3, "name": "Ravi Distributors", "role": "Middleman" },
  { "id": 4, "name": "Spice House", "role": "Consumer" },
  { "id": 5, "name": "Suresh Groceries", "role": "Consumer" }
];

export default function FarmerPage() {
  const [batches, setBatches] = useState<Batch[]>(sampleBatches);
  const [spices, setSpices] = useState<Spice[]>(sampleSpices);
  const [participants, setParticipants] = useState<Participant[]>(sampleParticipants);
  const [newTransactionItems, setNewTransactionItems] = useState<TransactionItem[]>(
    [{ sourceBatchId: "", recipientId: "", quantity: "", type: "middleman_transfer" }]
  );

  const handleAddItem = () => {
    setNewTransactionItems([
      ...newTransactionItems,
      { sourceBatchId: "", recipientId: "", quantity: "", type: "middleman_transfer" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const items = [...newTransactionItems];
    items.splice(index, 1);
    setNewTransactionItems(items);
  };

  const handleItemChange = (index: number, field: keyof TransactionItem, value: string) => {
    const items = [...newTransactionItems];
    items[index] = { ...items[index], [field]: value };
    setNewTransactionItems(items);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting Transactions:", newTransactionItems);
    alert("Transaction submitted! Check the console for data.");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Transaction Form Section */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Record a New Sale</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {newTransactionItems.map((item, index) => (
              <div key={index} className="flex flex-col gap-4 p-4 border rounded-lg border-slate-700">
                <h3 className="text-lg font-semibold">Sale Item {index + 1}</h3>
                <div className="flex gap-4">
                  {/* Source Batch Dropdown */}
                  <div className="flex-1">
                    <label className="block mb-1 text-sm">Select Source Batch</label>
                    <select
                      value={item.sourceBatchId}
                      onChange={(e) => handleItemChange(index, "sourceBatchId", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select Batch</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.id} ({b.spice}, {b.qty})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Recipient ID (Manual Input) */}
                  <div className="flex-1">
                    <label className="block mb-1 text-sm">Recipient ID</label>
                    <input
                      type="text"
                      value={item.recipientId}
                      onChange={(e) => handleItemChange(index, "recipientId", e.target.value)}
                      placeholder="e.g., 2, 3, 4"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  {/* Quantity */}
                  <div className="flex-1">
                    <label className="block mb-1 text-sm">Quantity (grams)</label>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      placeholder="e.g., 5000"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  {/* Transaction Type */}
                  <div className="flex-1">
                    <label className="block mb-1 text-sm">Transaction Type</label>
                    <select
                      value={item.type}
                      onChange={(e) => handleItemChange(index, "type", e.target.value as "middleman_transfer" | "consumer_package")}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="middleman_transfer">Sell to Middleman</option>
                      <option value="consumer_package">Create Consumer Package</option>
                    </select>
                  </div>
                </div>

                {newTransactionItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="self-end text-sm text-red-400 hover:text-red-500"
                  >
                    Remove Item
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-between items-center mt-2">
              <button
                type="button"
                onClick={handleAddItem}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm"
              >
                Add Another Item
              </button>
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                Complete Sale
              </button>
            </div>
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
                  <th className="p-2 whitespace-nowrap">Status</th>
                  <th className="p-2">Qty</th>
                </tr>
              </thead>
              <tbody>
                {batches.length > 0 ? (
                  batches.map((b) => (
                    <tr key={b.id} className="border-b border-slate-700 text-sm">
                      <td className="p-2">{b.id}</td>
                      <td className="p-2">{b.spice}</td>
                      <td className="p-2">{b.origin}</td>
                      <td className="p-2">{b.owner}</td>
                      <td className="p-2">{b.harvest_date}</td>
                      <td className="p-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            b.status === "Delivered"
                              ? "bg-green-600"
                              : b.status === "In Stock"
                              ? "bg-blue-600"
                              : "bg-yellow-600"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-2">{b.qty}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">
                      No batches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}