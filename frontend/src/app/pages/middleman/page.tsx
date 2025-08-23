"use client"
import { useState, FormEvent } from 'react';

export default function MiddlemanPage() {
  const [batchId, setBatchId] = useState<string>('');
  const [currentOwner, setCurrentOwner] = useState<string>('');
  const [newOwner, setNewOwner] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('Transferring batch...');

    const res = await fetch('http://localhost:3000/api/transferBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: parseInt(batchId),
        currentOwner,
        newOwner,
        quantity: parseInt(quantity),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage(`Success! Batch ID ${batchId} transferred to ${newOwner}.`);
    } else {
      setMessage(`Error: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Middleman - Transfer a Batch</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Batch ID:</label>
          <input type="number" value={batchId} onChange={(e) => setBatchId(e.target.value)} required />
        </div>
        <div>
          <label>Your Name (Current Owner):</label>
          <input type="text" value={currentOwner} onChange={(e) => setCurrentOwner(e.target.value)} required />
        </div>
        <div>
          <label>Recipient's Name (New Owner):</label>
          <input type="text" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} required />
        </div>
        <div>
          <label>Quantity to Transfer (kg):</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        <button type="submit">Transfer Batch</button>
      </form>
      {message && <p>{message}</p>}
      <br />
      <a href="/">
        Go Back Home
      </a>
    </div>
  );
}