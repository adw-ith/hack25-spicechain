import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-black flex flex-col items-center justify-end">
      {/* Background Image and Fade Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1509358271058-acd22cc93898?q=80&w=2070&auto=format&fit=crop')" }}
      >
        {/* Gradient overlay for the fading effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      {/* Content Container - positioned at the bottom */}
      <div className="relative z-10 w-full max-w-4xl p-8 text-center pb-16">
        {/* Title and Subtitle */}
        <h1 className="text-5xl md:text-6xl font-bold text-orange-500" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
          SpiceChain
        </h1>
        <p className="text-slate-200 mt-4 mb-10 text-lg">
          Transparently Tracking the Spice Journey.
        </p>

        {/* Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="pages/farmer" className="block bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:bg-orange-500 hover:text-slate-900 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300">
  I am a Farmer
          </Link>
          <Link href="pages/middleman" className="block bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:bg-orange-500 hover:text-slate-900 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300">
            I am a Middleman
          </Link>
          <Link href="pages/consumer" className="block bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:bg-orange-500 hover:text-slate-900 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300">
            I am a Consumer
          </Link>
        </div>
      </div>
    </main>
  );
}