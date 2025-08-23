"use client"
import { useState, FormEvent } from 'react';

export default function FarmerPage() {
  const [spiceType, setSpiceType] = useState<string>('');
  const [originLocation, setOriginLocation] = useState<string>('');
  const [initialQuantity, setInitialQuantity] = useState<string>('');
  const [farmerName, setFarmerName] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('Creating batch...');

    const res = await fetch('http://localhost:3000/api/createBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spiceType,
        originLocation,
        initialQuantity: parseInt(initialQuantity),
        farmerName,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage(`Success! Batch created with ID: ${data.batch.id}`);
    } else {
      setMessage(`Error: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Farmer - Create a New Batch</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Spice Type:</label>
          <input type="text" value={spiceType} onChange={(e) => setSpiceType(e.target.value)} required />
        </div>
        <div>
          <label>Origin Location:</label>
          <input type="text" value={originLocation} onChange={(e) => setOriginLocation(e.target.value)} required />
        </div>
        <div>
          <label>Initial Quantity (kg):</label>
          <input type="number" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} required />
        </div>
        <div>
          <label>Your Name:</label>
          <input type="text" value={farmerName} onChange={(e) => setFarmerName(e.target.value)} required />
        </div>
        <button type="submit">Create Batch</button>
      </form>
      {message && <p>{message}</p>}
      <br />
      <a href="/">Go Back Home</a>
    </div>
  );
}
