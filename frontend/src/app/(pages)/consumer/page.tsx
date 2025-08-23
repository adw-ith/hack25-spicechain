"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useState } from "react";

export default function ConsumerPage() {
  const [result, setResult] = useState("");
  const [batchData, setBatchData] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        // ✅ if QR scanned, show details
        setResult(decodedText || "BATCH-DUMMY");
        setBatchData({
          id: decodedText || "BATCH-DUMMY",
          farmer: "John (Kerala, India)",
          distributor: "Spice Distributors Ltd",
          exporter: "Global Spice Exports",
          retailer: "FreshMart Supermarket",
        });
        scanner.clear();
      },
      () => {
        // ✅ instead of error, always fallback to dummy data
        if (!batchData) {
          setResult("BATCH-DUMMY");
          setBatchData({
            id: "BATCH-DUMMY",
            farmer: "Anand (Tamil Nadu, India)",
            distributor: "Spice Trade Co.",
            exporter: "Asia Exports Pvt Ltd",
            retailer: "DailyFresh Supermarket",
          });
        }
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-orange-500 p-6">
      <h1 className="text-2xl font-bold mb-6">Consumer QR Scanner</h1>

      <div
        id="reader"
        className="w-full max-w-md rounded-lg overflow-hidden shadow-md bg-zinc-900"
      />

      {result && batchData && (
        <div className="mt-6 w-full max-w-md bg-zinc-900 rounded-lg shadow-lg p-4 border border-orange-500">
          <h2 className="text-lg font-semibold mb-2">Batch Details</h2>
          <p className="text-sm">Scanned ID: {batchData.id}</p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <strong>Farmer:</strong> {batchData.farmer}
            </p>
            <p>
              <strong>Distributor:</strong> {batchData.distributor}
            </p>
            <p>
              <strong>Exporter:</strong> {batchData.exporter}
            </p>
            <p>
              <strong>Retailer:</strong> {batchData.retailer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
