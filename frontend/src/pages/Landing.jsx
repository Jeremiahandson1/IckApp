import { Link } from 'react-router-dom';
import { Scan, ArrowRightLeft, ChevronRight, Skull, AlertTriangle, ShieldOff } from 'lucide-react';

const features = [
  {
    icon: Scan,
    title: 'Scan It',
    description: 'Point. Scan. See exactly what\'s hiding behind the marketing.'
  },
  {
    icon: Skull,
    title: 'Ick It',
    description: 'Red 40, TBHQ, sodium nitrite — we flag the stuff that shouldn\'t be in food.'
  },
  {
    icon: ArrowRightLeft,
    title: 'Swap It',
    description: 'We don\'t just scare you. We show you what to buy instead.'
  },
  {
    icon: ShieldOff,
    title: 'Protect Your People',
    description: 'Set allergen alerts for your whole family. One scan, everyone\'s covered.'
  }
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero — dark with orange accent */}
      <div className="pt-16 pb-12 px-6 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 bg-orange-500/100 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_40px_rgba(249,115,22,0.3)]">
            <span className="text-4xl font-black text-black tracking-tighter">ICK</span>
          </div>
        </div>
        
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
          Ick that <span className="text-orange-500">sh—</span>
        </h1>
        <p className="text-lg text-gray-400 mb-8 max-w-xs mx-auto">
          Scan any food product. See what's really in it.<br />
          Then put it back on the shelf.
        </p>

        <Link
          to="/scan"
          className="inline-flex items-center gap-2 bg-orange-500/100 text-black font-bold py-4 px-8 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-95 transition-transform text-lg"
        >
          Start Scanning
          <ChevronRight className="w-5 h-5" />
        </Link>

        <p className="mt-4 text-gray-500 text-sm">
          Free. No account required.{' '}
          <Link to="/login" className="text-orange-500 underline">Sign in</Link>
        </p>
      </div>

      {/* Features */}
      <div className="bg-[#111] rounded-t-3xl pt-8 pb-12 px-6">
        <h2 className="text-xl font-bold text-gray-200 mb-6 text-center">
          Know what you're feeding your family.
        </h2>

        <div className="space-y-3 max-w-md mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-2xl bg-[#1a1a1a] border border-gray-800/50"
            >
              <div className="bg-orange-500/100/10 rounded-xl p-3">
                <feature.icon className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-white">{feature.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-center max-w-md mx-auto">
          <div>
            <p className="text-2xl font-black text-orange-500">2M+</p>
            <p className="text-xs text-gray-500">Products scanned</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-500">56</p>
            <p className="text-xs text-gray-500">Recipes to replace the junk</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-500">48</p>
            <p className="text-xs text-gray-500">Harmful additives flagged</p>
          </div>
        </div>

        {/* The pitch */}
        <div className="mt-10 max-w-md mx-auto text-center">
          <p className="text-gray-400 text-sm leading-relaxed">
            Ick scores every product on nutrition (60%), additives (30%), and organic status (10%). 
            No opinions. No ads. No brand deals. 
            Just science and the ingredient list they hope you won't read.
          </p>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 bg-orange-500/100 text-black font-bold py-3 px-6 rounded-xl active:scale-95 transition-transform"
          >
            Scan Something
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
