'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';

interface KeyDevelopment {
  headline: string;
  detail: string;
  sources: string[];
  severity: 'critical' | 'high' | 'moderate' | 'routine';
  confidence?: 'high' | 'medium' | 'low';
}

interface UsageData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

interface BriefingData {
  region: WatchpointId;
  timeWindowHours: number;
  generatedAt: string;
  summary: string;
  tensionScore?: number;
  keyDevelopments: KeyDevelopment[];
  watchIndicators?: string[];
  sourcesAnalyzed: number;
  topSources: string[];
  fromCache?: boolean;
  usage?: UsageData;
}

interface InlineBriefingProps {
  region: WatchpointId;
}

// Light theme severity styles
const severityStyles: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  high: { dot: 'bg-orange-500', text: 'text-orange-600' },
  moderate: { dot: 'bg-amber-500', text: 'text-amber-600' },
  routine: { dot: 'bg-slate-400', text: 'text-slate-500' },
};

const confidenceStyles: Record<string, string> = {
  high: 'text-emerald-600',
  medium: 'text-amber-600',
  low: 'text-slate-500',
};

// Tension level styling - Light theme
function getTensionStyle(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 8) return { label: 'CRITICAL', color: 'text-red-600', bgColor: 'bg-red-100' };
  if (score >= 6) return { label: 'HIGH', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  if (score >= 4) return { label: 'ELEVATED', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  if (score >= 2) return { label: 'WATCHFUL', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  return { label: 'STABLE', color: 'text-emerald-600', bgColor: 'bg-emerald-100' };
}

interface FollowUpResponse {
  question: string;
  answer: string;
  usage?: UsageData;
}

export function InlineBriefing({ region }: InlineBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow-up question state
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpResponses, setFollowUpResponses] = useState<FollowUpResponse[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchBriefing = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/summary?region=${region}&hours=4`);
        if (!response.ok) {
          throw new Error('Failed to fetch briefing');
        }
        const data = await response.json();
        setBriefing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading briefing');
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
    // Clear follow-ups when region changes
    setFollowUpResponses([]);
    setFollowUpQuestion('');
    setShowFollowUp(false);
  }, [region]);

  // Handle follow-up question submission
  const handleFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!followUpQuestion.trim() || !briefing || followUpLoading) return;

    setFollowUpLoading(true);
    const question = followUpQuestion.trim();
    setFollowUpQuestion('');

    try {
      const response = await fetch('/api/briefing-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          region,
          briefingSummary: briefing.summary,
          tensionScore: briefing.tensionScore || 5,
          keyDevelopments: briefing.keyDevelopments.map(d => ({
            headline: d.headline,
            detail: d.detail,
            severity: d.severity,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get answer');

      const data = await response.json();
      setFollowUpResponses(prev => [...prev, {
        question,
        answer: data.answer,
        usage: data.usage,
      }]);
    } catch {
      setFollowUpResponses(prev => [...prev, {
        question,
        answer: 'Sorry, I could not process that question. Please try again.',
      }]);
    } finally {
      setFollowUpLoading(false);
      inputRef.current?.focus();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="mx-4 my-3 px-4 py-3 border border-slate-200 rounded-lg bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Generating briefing...</span>
        </div>
      </div>
    );
  }

  // Error state - just hide
  if (error || !briefing) {
    return null;
  }

  const tensionScore = briefing.tensionScore || 5;
  const tension = getTensionStyle(tensionScore);

  return (
    <div className="mx-4 my-3 border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              AI Summary
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">{regionDisplayNames[region]}</span>
            {briefing.fromCache && (
              <span className="text-[10px] text-slate-400">(cached)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${tension.bgColor} ${tension.color}`}>
              {tension.label}
            </span>
            <span className="text-xs text-slate-500">{tensionScore}/10</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Summary */}
        <p className="text-sm text-slate-700 leading-relaxed">
          {briefing.summary}
        </p>

        {/* Top 3 Key Developments */}
        {briefing.keyDevelopments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="space-y-2">
              {briefing.keyDevelopments.slice(0, 3).map((dev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${severityStyles[dev.severity].dot} mt-1.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-800">{dev.headline}</span>
                      {dev.confidence && (
                        <span className={`text-[9px] ${confidenceStyles[dev.confidence]}`}>
                          {dev.confidence} conf.
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{dev.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up questions */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowFollowUp(!showFollowUp)}
            className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
          >
            {showFollowUp ? 'Hide' : 'Ask'} follow-up
          </button>

          {showFollowUp && (
            <div className="mt-2 space-y-2">
              {/* Previous Q&A */}
              {followUpResponses.map((resp, i) => (
                <div key={i} className="text-xs space-y-1">
                  <div className="text-slate-600 font-medium">Q: {resp.question}</div>
                  <div className="text-slate-500 pl-3 border-l-2 border-slate-200">
                    {resp.answer}
                  </div>
                </div>
              ))}

              {followUpLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Thinking...
                </div>
              )}

              <form onSubmit={handleFollowUp} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  placeholder="Ask about this..."
                  disabled={followUpLoading}
                  className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded
                    text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500
                    disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={followUpLoading || !followUpQuestion.trim()}
                  className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded
                    hover:bg-slate-50 hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer - usage stats */}
      {briefing.usage && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>{briefing.sourcesAnalyzed} posts analyzed</span>
          <div className="flex items-center gap-2">
            <span>{briefing.usage.inputTokens + briefing.usage.outputTokens} tokens</span>
            <span>•</span>
            <span>{(briefing.usage.latencyMs / 1000).toFixed(1)}s</span>
            <span>•</span>
            <span>${briefing.usage.costUsd.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
