"use client"
import { useState, FormEvent } from 'react';
import Link from 'next/link';

// Define the shape of a single history entry
interface TransferHistory {
  from: string;
  to: string;
  quantity: number;
  timestamp: string;
}

export default function ConsumerPage() {
  const [batchId, setBatchId] = useState<string>('');
  const [history, setHistory] = useState<TransferHistory[] | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleFetchHistory = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('Fetching history...');
    setHistory(null);

    const res = await fetch(`http://localhost:3000/api/getHistory/${batchId}`);
    const data = await res.json();

    if (res.ok) {
      setHistory(data.history as TransferHistory[]);
      setMessage('History retrieved successfully.');
    } else {
      setMessage(`Error: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Consumer - Check Batch History</h1>
      <form onSubmit={handleFetchHistory}>
        <div>
          <label>Enter Batch ID:</label>
          <input type="number" value={batchId} onChange={(e) => setBatchId(e.target.value)} required />
        </div>
        <button type="submit">Get History</button>
      </form>

      {message && <p>{message}</p>}

      {history && history.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Batch History</h2>
          <ol>
            {history.map((entry, index) => (
              <li key={index}>
                <strong>From:</strong> {entry.from} <br />
                <strong>To:</strong> {entry.to} <br />
                <strong>Quantity:</strong> {entry.quantity} kg <br />
                <strong>Timestamp:</strong> {new Date(entry.timestamp).toLocaleString()}
              </li>
            ))}
          </ol>
        </div>
      )}

      {history && history.length === 0 && <p>No history found for this batch.</p>}

      <br />
        <a href="/">Go Back Home</a>
    </div>
  );
}