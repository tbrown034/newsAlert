'use client';

import { useState } from 'react';
import {
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

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
              {/* Source Tiers */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Source Tiers
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Sources are categorized by their typical relationship to events.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">OFFICIAL</span>
                    <span className="text-slate-500">Government, military, agency accounts</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">OSINT</span>
                    <span className="text-slate-500">Open-source intelligence analysts</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">REPORTER</span>
                    <span className="text-slate-500">Journalists and news organizations</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">GROUND</span>
                    <span className="text-slate-500">Eyewitnesses and local sources</span>
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
                <p className="text-caption text-slate-400 mt-3 italic">
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
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-subtle" />
                    <span className="text-xs text-slate-500">Critical surge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
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

              {/* Severity */}
              <section>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Severity Levels
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Detected from keywords and patterns in posts.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">CRITICAL</span>
                    <span className="text-slate-500">Major incidents, attacks, disasters</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">HIGH</span>
                    <span className="text-slate-500">Significant events, escalations</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">MODERATE</span>
                    <span className="text-slate-500">Developments worth monitoring</span>
                  </div>
                </div>
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
