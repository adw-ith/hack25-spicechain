"use client"; // Convert to a client component to use state and effects

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [traceData, setTraceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!packageId.trim()) {
      setError("Please enter a package ID.");
      return;
    }
    setIsLoading(true);
    setError("");
    setTraceData(null);

    try {
      // Assumes your Flask backend is running on port 5001
      const response = await fetch(`http://127.0.0.1:5001/trace/${packageId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch trace data. Status: ${response.status}`);
      }
const data = await response.json();
      setTraceData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setTraceData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPackageId("");
    setTraceData(null);
    setError("");
  };

  return (
    <>
      <main className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-slate-900">
        {/* ... existing code ... */}
        <div className="absolute inset-0 z-0">
          <Image src="/colorful-spice-market.png" alt="Spice trading background" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-900/90 to-slate-900/95"></div>
        </div>

        <div className="relative z-10 w-full max-w-5xl p-8 text-center flex flex-col justify-end min-h-[50vh] mt-auto mb-8">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-2">
            Spice<span className="text-orange-500">Chain</span>
          </h1>
          <p className="text-slate-200 mt-6 mb-16 text-xl md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed">
            Transparently Tracking the Spice Journey.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <Link
              href="/pages/farmer"
              className="block bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-lg"
            >
              I am a Farmer
            </Link>
            <Link
              href="/pages/middleman"
              className="block bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-lg"
            >
              I am a Middleman
            </Link>
            <Link
              href="/pages/consumer"
              className="block bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-lg"
            >
              I am a Consumer
            </Link>
            <a
              href="/trace"
              onClick={openModal}
              className="block bg-slate-800/80 border-2 border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white font-bold py-5 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm text-lg cursor-pointer"
            >
              Find a Batch
            </a>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md relative border border-slate-700">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">&times;</button>
            <h2 className="text-2xl font-bold text-white mb-6">Trace Your Spice</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                placeholder="Enter Package ID (e.g., KSPICE-XXXX)"
                className="flex-grow bg-slate-900 text-white border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:bg-orange-800 disabled:cursor-not-allowed"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
            
            {error && <p className="text-red-400 mt-4">{error}</p>}

            {traceData && (
              <div className="mt-6 text-left text-slate-300 bg-slate-900/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Trace Results:</h3>
                <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(traceData, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}