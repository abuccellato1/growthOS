import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getSystemPrompt } from '@/lib/prompts'
import { Phase, Message } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ChatRequest {
  messages: Message[]
  phase: Phase
  customerContext?: string
}

export async function POST(request: Request) {
  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, phase, customerContext } = body

  if (!messages || !phase) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let systemPrompt = getSystemPrompt(phase)

  // Prepend customer context to Phase 1 system prompt only
  if (phase === 1 && customerContext) {
    systemPrompt = `${customerContext}\n\n${systemPrompt}`
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: anthropicMessages,
          stream: true,
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        controller.close()
      } catch (error) {
        console.error('Anthropic API error:', error)
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
