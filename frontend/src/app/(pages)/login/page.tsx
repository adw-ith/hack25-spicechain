"use client";
import { useState } from "react";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isProducer, setIsProducer] = useState(false); // New state for producer role
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null); // New state for location
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setError("");
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError("Unable to retrieve location. Please enable location services.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    try {
      const endpoint = activeTab === "login" ? "/login" : "/signup";
      
      const requestBody = activeTab === "login"
        ? { username: email, password }
        : { 
            username : name, 
            email, 
            password,
            user_type: isProducer ? "producer" : "consumer", // Determine user type
            location: location,
          };
      console.log("Request Body:", requestBody);
      const res = await fetch(`http://127.0.0.1:5000/api${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log(data);

      if (!res.ok) throw new Error(data.detail || "Something went wrong");

      if (activeTab === "login") {
        localStorage.setItem("token", data.token);
        alert("Login successful!");
      } else {
        alert("Signup successful! Please login.");
        setActiveTab("login");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-slate-900">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-700">
        {/* Tabs */}
        <div className="flex justify-between mb-6 border-b border-slate-700">
          <button
            className={`flex-1 py-2 text-lg font-semibold ${
              activeTab === "login"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-slate-400"
            }`}
            onClick={() => setActiveTab("login")}
          >
            Login
          </button>
          <button
            className={`flex-1 py-2 text-lg font-semibold ${
              activeTab === "signup"
                ? "text-orange-500 border-b-2 border-orange-500"
                : "text-slate-400"
            }`}
            onClick={() => setActiveTab("signup")}
          >
            Signup
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          {activeTab === "signup" && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-900 text-white border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="is-producer"
                  checked={isProducer}
                  onChange={(e) => setIsProducer(e.target.checked)}
                  className="form-checkbox text-orange-500 bg-slate-900 border-slate-600 rounded"
                />
                <label htmlFor="is-producer" className="text-slate-400">
                  Are you a producer?
                </label>
              </div>
              {isProducer && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-all duration-300"
                  >
                    Get My Location
                  </button>
                  {location && (
                    <p className="text-sm text-green-400">
                      Location captured: Lat {location.lat.toFixed(4)}, Lng {location.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-900 text-white border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-900 text-white border border-slate-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-all duration-300 disabled:bg-orange-800 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Please wait..."
              : activeTab === "login"
              ? "Login"
              : "Signup"}
          </button>
        </div>

        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
}