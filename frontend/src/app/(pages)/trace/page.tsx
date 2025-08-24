"use client";

import { useState, useRef, useEffect } from "react";
import { BrowserMultiFormatReader, BrowserQRCodeReader } from "@zxing/library";

interface Event {
  timestamp: string;
  event_type: string;
  description: string;
  user: string;
  location: string;
  metadata: any;
  context_id: string;
}

interface PackageHistory {
  package_details: {
    package_id: string;
    spice_name: string;
    quantity_kg: number;
    package_date: string;
    packaged_by: string;
    status: string;
  };
  origin_details: {
    root_batch_id: string;
    original_farmer: string;
    harvest_date: string;
    farm_location: string;
    farming_method: string;
    original_quantity_kg: number;
  };
  full_journey: Event[];
}

export default function TracePage() {
  const [packageId, setPackageId] = useState("");
  const [history, setHistory] = useState<PackageHistory | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchHistory = async (id?: string) => {
    const pid = id || packageId;
    if (!pid) return;

    setError("");
    setHistory(null);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/trace/${pid}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to fetch history");
        return;
      }
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      setError("Network error");
    }
  };

  // Camera QR Scanner
  useEffect(() => {
    if (!videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    codeReader
      .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          setPackageId(result.getText());
          fetchHistory(result.getText());
          codeReader.reset(); // Stop after first scan
        }
        if (err) {
          // ignore camera noise errors
        }
      })
      .catch(console.error);

    return () => codeReader.reset();
  }, []);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (ev) => {
      if (!ev.target?.result) return;
      const img = new Image();
      img.src = ev.target.result as string;

      img.onload = async () => {
        try {
          const codeReader = new BrowserQRCodeReader();
          const result = await codeReader.decodeFromImage(img);
          if (result) {
            setPackageId(result.getText());
            fetchHistory(result.getText());
          }
        } catch (err) {
          setError("Failed to read QR code from image");
        }
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-black text-orange-400 p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-orange-500">
        Trace Package History
      </h1>

      {/* Input + Trace Button */}
      <div className="flex gap-2 mb-6 max-w-lg mx-auto">
        <input
          type="text"
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          placeholder="Enter Package ID"
          className="flex-1 p-3 rounded bg-gray-900 border border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={() => fetchHistory()}
          className="px-6 py-3 bg-orange-500 text-black font-semibold rounded hover:bg-orange-600 transition"
        >
          Trace
        </button>
      </div>

      {/* QR Scanner - Camera */}
      <div className="max-w-lg mx-auto mb-4 border border-orange-500 rounded overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-64 object-cover"
          muted
          playsInline
        />
      </div>

      {/* QR Scanner - Image Upload */}
      <div className="max-w-lg mx-auto mb-6 flex flex-col gap-2">
        <label className="text-orange-300 font-semibold">
          Or upload QR image:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="text-white p-2 rounded"
        />
      </div>

      {error && (
        <p className="text-red-500 text-center mb-4 font-semibold">{error}</p>
      )}

      {history && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Package Details */}
          <div className="bg-gray-900 p-4 rounded shadow border border-orange-500">
            <h2 className="text-xl font-bold mb-2 text-orange-300">
              Package Details
            </h2>
            <ul className="space-y-1">
              {Object.entries(history.package_details).map(([key, val]) => (
                <li key={key}>
                  <span className="font-semibold text-orange-400">{key}:</span>{" "}
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Origin Details */}
          <div className="bg-gray-900 p-4 rounded shadow border border-orange-500">
            <h2 className="text-xl font-bold mb-2 text-orange-300">
              Origin Details
            </h2>
            <ul className="space-y-1">
              {Object.entries(history.origin_details).map(([key, val]) => (
                <li key={key}>
                  <span className="font-semibold text-orange-400">{key}:</span>{" "}
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full Journey Timeline */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2 text-orange-300">
              Full Journey
            </h2>
            {history.full_journey.map((event, idx) => (
              <div
                key={idx}
                className="bg-gray-900 p-4 rounded shadow border-l-4 border-orange-500 hover:bg-gray-800 transition"
              >
                <p>
                  <span className="font-semibold text-orange-400">Time:</span>{" "}
                  {new Date(event.timestamp).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold text-orange-400">
                    Context:
                  </span>{" "}
                  {event.context_id}
                </p>
                <p>
                  <span className="font-semibold text-orange-400">Type:</span>{" "}
                  {event.event_type}
                </p>
                <p>
                  <span className="font-semibold text-orange-400">
                    Description:
                  </span>{" "}
                  {event.description}
                </p>
                <p>
                  <span className="font-semibold text-orange-400">User:</span>{" "}
                  {event.user}
                </p>
                <p>
                  <span className="font-semibold text-orange-400">
                    Location:
                  </span>{" "}
                  {event.location}
                </p>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <pre className="bg-gray-800 p-2 mt-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
