'use client';

import { useState } from 'react';
import {
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { provenanceSpectrum, provenanceConfig, provenanceColors } from '@/lib/provenance';

export function Legend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Legend toggle button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-lg transition-colors"
        title="View legend"
      >
        <InformationCircleIcon className="w-5 h-5 text-slate-500" />
      </button>

      {/* Legend modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal content */}
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 font-serif">Understanding Your Feed</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Source Access Key - The Core Concept */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Source Access Key
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Shows how information was obtained, not how &quot;true&quot; it is.
                  Closer to the event = warmer colors.
                </p>

                {/* Provenance Spectrum - Visual gradient bar */}
                <div className="mb-4">
                  <div className="flex h-2 rounded-full overflow-hidden">
                    {provenanceSpectrum.map((type) => (
                      <div
                        key={type}
                        className="flex-1"
                        style={{ backgroundColor: provenanceColors[type] }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                    <span>Close to event</span>
                    <span>Further from event</span>
                  </div>
                </div>

                {/* Provenance Types */}
                <div className="space-y-3">
                  {provenanceSpectrum.map((type) => {
                    const config = provenanceConfig[type];
                    return (
                      <div key={type} className="flex items-start gap-3">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 ${config.bgColor} rounded-md min-w-[110px]`}
                        >
                          <span className="text-sm">{config.icon}</span>
                          <span className={`text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 leading-relaxed">
                          {config.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Aggregator Chains */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Aggregator Chains
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Aggregators show what type of content they typically amplify.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">📡 Aggregated → Ground</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Amplifies eyewitness reports</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">📡 Aggregated → Analysis</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Amplifies OSINT analysis</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-600">📡 Aggregated → Mixed</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Multiple source types</span>
                  </div>
                </div>
              </section>

              {/* Activity Anomaly Detection */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Activity Signals
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Shows when a source is posting more than usual—a potential early warning.
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-red-500 text-lg">🔥</span>
                    <span className="text-xs text-slate-600">5x+ normal rate - highly unusual</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-orange-500 text-lg">⚡</span>
                    <span className="text-xs text-slate-600">3-5x normal rate - notable spike</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-500 text-lg">📈</span>
                    <span className="text-xs text-slate-600">2-3x normal rate - above baseline</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 italic">
                  Example: &quot;5 posts in 2h (usually ~3/day)&quot;
                </p>
              </section>

              {/* Regional Surge */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Regional Surges
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  When multiple sources for a region spike together, something significant may be happening.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-slate-500">Critical surge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-xs text-slate-500">High activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-500">Elevated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500">Normal</span>
                  </div>
                </div>
              </section>

              {/* Philosophy */}
              <section className="pt-2 border-t border-slate-200">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <strong className="text-slate-600">Philosophy:</strong> We show you <em>access</em>, not <em>truth claims</em>.
                  A reporter may cite &quot;anonymous sources&quot; while an aggregator shares raw footage.
                  Both have value. This system helps you understand the information chain without
                  making the judgment for you.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Breaking news before it&apos;s news
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
