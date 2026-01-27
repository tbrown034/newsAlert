/**
 * AI BRIEFING FOLLOW-UP API
 * =========================
 * Handles follow-up questions about a region briefing.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { WatchpointId } from '@/types';
import { regionDisplayNames } from '@/lib/regionDetection';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Allow up to 30 seconds for AI response

// Model pricing per 1M tokens
const MODEL_PRICING = {
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0 },
};

interface FollowUpRequest {
  question: string;
  region: WatchpointId;
  briefingSummary: string;
  tensionScore: number;
  keyDevelopments: Array<{
    headline: string;
    detail: string;
    severity: string;
  }>;
}

// Sanitize user input to prevent prompt injection attacks
function sanitizePromptInput(input: string, maxLength: number = 1000): string {
  return input
    .replace(/```/g, "'''")              // Escape code blocks
    .replace(/\${/g, '\\${')             // Escape template literals
    .replace(/<\/?[a-z][^>]*>/gi, '')    // Remove HTML/XML tags
    .replace(/\n{3,}/g, '\n\n')          // Limit consecutive newlines
    .trim()
    .substring(0, maxLength);
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body: FollowUpRequest = await request.json();
    const { question, region, briefingSummary, tensionScore, keyDevelopments } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const regionName = regionDisplayNames[region] || region;
    const model = 'claude-3-5-haiku-20241022';

    // Sanitize all user-provided inputs to prevent prompt injection
    const safeQuestion = sanitizePromptInput(question, 500);
    const safeSummary = sanitizePromptInput(briefingSummary, 2000);
    const safeTensionScore = Math.min(Math.max(1, Math.round(tensionScore)), 10);

    // Build context for the follow-up (sanitize each development)
    const developmentsSummary = keyDevelopments
      .slice(0, 10) // Limit number of developments
      .map(d => `- [${sanitizePromptInput(d.severity, 20).toUpperCase()}] ${sanitizePromptInput(d.headline, 100)}: ${sanitizePromptInput(d.detail, 200)}`)
      .join('\n');

    // Temporal grounding for follow-up responses
    const now = new Date();
    const currentTimeStr = now.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });

    const prompt = `You are a senior intelligence analyst answering a follow-up question about the ${regionName} situation.

Current time: ${currentTimeStr}

Briefing context (covers the last several hours):
- Region: ${regionName}
- Tension Score: ${safeTensionScore}/10
- Summary: ${safeSummary}

Key Developments:
${developmentsSummary || 'None reported'}

User Question: ${safeQuestion}

Provide a concise, factual response (2-4 sentences). Reference time naturally when relevant (e.g., "this morning's statement", "in the past hour"). Focus on what's known from the briefing context. If the question asks about something not covered in the briefing, acknowledge that limitation.`;

    const client = new Anthropic();

    // Use streaming to avoid Vercel timeout
    const stream = client.messages.stream({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    // Collect streamed text
    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
      }
    }

    // Get final message for usage stats
    const finalMessage = await stream.finalMessage();
    const latencyMs = Date.now() - startTime;

    // Extract usage
    const inputTokens = finalMessage.usage?.input_tokens || 0;
    const outputTokens = finalMessage.usage?.output_tokens || 0;

    // Calculate cost
    const pricing = MODEL_PRICING[model];
    const costUsd = (inputTokens * pricing.input / 1_000_000) +
                    (outputTokens * pricing.output / 1_000_000);

    return NextResponse.json({
      answer: fullText,
      usage: {
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        costUsd: Math.round(costUsd * 100000) / 100000,
      },
    });
  } catch (error) {
    console.error('Briefing follow-up error:', error);
    return NextResponse.json(
      { error: 'Failed to process follow-up question' },
      { status: 500 }
    );
  }
}
