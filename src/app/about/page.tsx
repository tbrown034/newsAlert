'use client';

import { useState } from 'react';
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  UserIcon,
  GlobeAltIcon,
  BoltIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ChevronDownIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

export default function AboutPage() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDataFlow, setShowDataFlow] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 sm:h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section className="text-center py-8">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            About News Pulse
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Real-time global intelligence monitoring for those who need to know first.
          </p>
        </section>

        {/* About the Site */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <GlobeAltIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                What is News Pulse?
              </h2>
            </div>
          </div>
          <div className="px-6 py-6 space-y-4 text-slate-600 dark:text-slate-300">
            <p>
              News Pulse is a real-time global intelligence dashboard that aggregates and analyzes
              <strong className="text-slate-900 dark:text-white"> 478 verified OSINT sources</strong> to
              deliver breaking news before it hits mainstream media.
            </p>
            <p>
              The platform monitors 219 RSS feeds from major news organizations, wire services, and regional
              outlets alongside 222 curated Bluesky accounts from journalists, analysts, and official
              government channels, plus Telegram, Mastodon, Reddit, and YouTube sources.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">478</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sources</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">6</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Map Layers</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">5</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Regions</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">24/7</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monitoring</p>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Coverage Areas</h3>
              <div className="flex flex-wrap gap-2">
                {['Breaking News', 'Earthquakes (6.0+)', 'Wildfires', 'Weather Alerts', 'Internet Outages', 'Travel Advisories'].map((item) => (
                  <span key={item} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How the Formulas Work */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                How the Ranking Works
              </h2>
            </div>
          </div>
          <div className="px-6 py-6 space-y-6 text-slate-600 dark:text-slate-300">
            <p>
              News Pulse keeps it simple: posts appear in <strong className="text-slate-900 dark:text-white">chronological order</strong> (newest first)
              from all sources. No algorithmic manipulation or engagement-based ranking. What you see is what&apos;s happening, as it happens.
            </p>

            {/* Activity Surge */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BoltIcon className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Activity Surge Detection</h3>
              </div>
              <p className="text-sm">
                Instead of static rankings, News Pulse monitors <strong className="text-slate-900 dark:text-white">posting frequency</strong> in
                real-time. Each region has a baseline rate of normal activity. When posts spike above that baseline, the system flags it:
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  posts in last hour ÷ regional baseline = activity multiplier
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      <span className="font-medium text-slate-900 dark:text-white">Critical</span>
                    </div>
                    <span className="font-mono text-red-600 dark:text-red-400">&ge; 4x normal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="font-medium text-slate-900 dark:text-white">Elevated</span>
                    </div>
                    <span className="font-mono text-amber-600 dark:text-amber-400">&ge; 2x normal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span className="font-medium text-slate-900 dark:text-white">Normal</span>
                    </div>
                    <span className="font-mono text-slate-600 dark:text-slate-400">&lt; 2x normal</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This approach surfaces breaking news organically - when many sources start posting about the same event,
                the activity spike becomes visible without needing to manually flag stories as &quot;breaking.&quot;
              </p>
            </div>
          </div>
        </section>

        {/* About Me */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-700 to-slate-800 px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Trevor Brown</h2>
                <p className="text-slate-300 text-sm">
                  Investigative journalist + developer + data visualizer
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6 text-slate-600 dark:text-slate-300">
            <p>
              I spent 15+ years chasing public records and holding power accountable as an
              investigative reporter. Now I build interactive tools that transform complex data
              into accessible insights.
            </p>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Background</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">-</span>
                  <span>Editor-in-Chief at The Indiana Daily Student</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">-</span>
                  <span>Statehouse reporter for Wyoming Tribune Eagle</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">-</span>
                  <span>Investigative reporter with Oklahoma Watch (nonprofit newsroom)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">-</span>
                  <span>Multiple first-place awards from Oklahoma SPJ for investigative and government reporting</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Why I Built News Pulse</h3>
              <p className="text-sm">
                As a journalist, I know the value of being first with accurate information.
                I built News Pulse to aggregate the sources I already trust into a single dashboard,
                surfacing breaking news faster than traditional media with full transparency about
                where every story comes from.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Connect</h3>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/tbrown034"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  <span className="text-sm font-medium">GitHub</span>
                </a>
                <a
                  href="https://linkedin.com/in/trevorabrown"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  <span className="text-sm font-medium">LinkedIn</span>
                </a>
                <a
                  href="https://trevorthewebdeveloper.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <GlobeAltIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Website</span>
                </a>
                <a
                  href="mailto:trevorbrown.web@gmail.com"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span className="text-sm font-medium">Email</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* AI Transparency */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                AI Transparency
              </h2>
            </div>
          </div>
          <div className="px-6 py-6 space-y-6 text-slate-600 dark:text-slate-300">
            <p>
              News Pulse uses AI in two distinct ways: as a development tool and as a user-facing feature.
              Here&apos;s an honest breakdown of both.
            </p>

            {/* Development Process */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">How This Site Was Built</h3>
              <p className="text-sm">
                I built News Pulse using{' '}
                <a
                  href="https://www.anthropic.com/claude-code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Claude Code
                </a>
                , Anthropic&apos;s AI coding assistant. But this wasn&apos;t &quot;vibe coding&quot; where you
                describe an app and hope for the best. I drove every decision:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Architecture decisions</strong> - I chose Next.js, the source curation approach, and the activity detection system</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Code review</strong> - I inspect every change Claude suggests, often requesting modifications or rejecting approaches</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Iterative refinement</strong> - Features evolve through back-and-forth conversation, not one-shot prompts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Domain expertise</strong> - My journalism background shapes what sources to trust, how to rank content, and what matters in breaking news</span>
                </li>
              </ul>
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                Think of it like pair programming with a very fast junior developer who needs constant direction.
              </p>
            </div>

            {/* AI-Generated Briefings */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">AI-Generated Situation Briefings</h3>
              <p className="text-sm">
                The &quot;AI Summary&quot; feature on the main page uses{' '}
                <a
                  href="https://www.anthropic.com/claude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Claude
                </a>
                {' '}to synthesize recent posts into a situation overview. Here&apos;s how it works:
              </p>

              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">1</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Select</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">The 25 most recent posts are selected from the feed</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">2</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Analyze</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Claude reads headlines, content, and source metadata</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-2">
                    <span className="text-violet-600 dark:text-violet-400 font-bold text-sm">3</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Synthesize</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Returns a big-picture overview with 2-3 key developments</p>
                </div>
              </div>

              <div className="pt-2 text-sm">
                <strong className="text-slate-900 dark:text-white">Model tiers:</strong>
                <ul className="mt-1 space-y-1">
                  <li><span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">Quick</span> - Claude Haiku 3.5 (fast, economical)</li>
                  <li><span className="text-blue-600 dark:text-blue-400 font-mono text-xs">Advanced</span> - Claude Sonnet 4 (balanced)</li>
                  <li><span className="text-violet-600 dark:text-violet-400 font-mono text-xs">Pro</span> - Claude Opus 4.5 (most capable)</li>
                </ul>
              </div>
            </div>

            {/* The Actual Prompt */}
            <div className="space-y-3">
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <CodeBracketIcon className="w-5 h-5" />
                <span>See the Actual Prompt</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showPrompt ? 'rotate-180' : ''}`} />
              </button>

              {showPrompt && (
                <div className="bg-slate-900 dark:bg-black rounded-xl p-4 overflow-x-auto border border-slate-700">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
{`You are a news editor writing a brief situation update for {region}.

Current time: {currentTime}
Window: {startTime} to {nowTime} ({timeWindowHours}h)

<posts>
{postsJson}  // Compact JSON with: source, sourceType, minutesAgo, title, content
</posts>

Write a concise briefing in JSON:
{
  "overview": "1-2 sentences. What's the overall picture? Are tensions rising, stable, or easing? Give context.",
  "developments": [
    "Specific event + source (e.g., 'Ukraine reported 49 clashes since dawn - Ukrinform')",
    "Another key development + source",
    "Third if significant, otherwise omit"
  ]
}

Rules:
- Overview = big picture assessment, not a list of events
- Developments = 2-3 specific items with sources, each one line
- Reference time naturally (this morning, overnight, since dawn)
- No jargon, no severity labels, no scores`}
                  </pre>
                </div>
              )}
            </div>

            {/* Data Privacy */}
            <div className="space-y-3">
              <button
                onClick={() => setShowDataFlow(!showDataFlow)}
                className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <ShieldCheckIcon className="w-5 h-5" />
                <span>Data Flow & Privacy</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${showDataFlow ? 'rotate-180' : ''}`} />
              </button>

              {showDataFlow && (
                <div className="text-sm space-y-3 pl-7">
                  <div className="space-y-2">
                    <p className="font-medium text-slate-900 dark:text-white">What gets sent to Claude:</p>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                      <li>- Post headlines and content (public news)</li>
                      <li>- Source names and types</li>
                      <li>- Timestamps</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-slate-900 dark:text-white">What&apos;s NOT sent:</p>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                      <li>- Your IP address or identity</li>
                      <li>- Any user data or preferences</li>
                      <li>- Which region you&apos;re viewing</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-slate-900 dark:text-white">Caching:</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      Summaries are cached for 10 minutes on the server. Multiple users requesting the same
                      region will get the cached result, reducing API calls and cost.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Why Anthropic */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">Why Anthropic?</h3>
              <p className="text-sm">
                I chose{' '}
                <a
                  href="https://www.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Anthropic
                </a>
                {' '}for a few reasons:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Safety focus</strong> - Their research on AI safety aligns with my concerns about responsible AI deployment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Writing quality</strong> - Claude produces more natural, less &quot;AI-sounding&quot; text for news synthesis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Claude Code</strong> - Their developer tools made building this site more collaborative than other options</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-500 mt-1">-</span>
                  <span><strong className="text-slate-900 dark:text-white">Cost structure</strong> - Tiered models (Haiku/Sonnet/Opus) let me offer different quality levels</span>
                </li>
              </ul>
            </div>

            {/* Limitations */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">AI Limitations</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                AI summaries can make mistakes. They may miss important context, misinterpret sources,
                or occasionally hallucinate details. The summary is meant to complement the raw feed,
                not replace it. Always check the source posts for critical information.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          <p>Built with Next.js, TypeScript, and Claude AI</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} News Pulse. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
