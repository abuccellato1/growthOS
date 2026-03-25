export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { checkRateLimit, getIpIdentifier } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'
import { apiError } from '@/lib/api-response'

// ─── Markdown parser ──────────────────────────────────────────────────────────

interface Run {
  text: string
  bold?: boolean
  italic?: boolean
}

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; runs: Run[] }
  | { type: 'li'; runs: Run[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }

function parseInline(text: string): Run[] {
  const runs: Run[] = []
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|([^*]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) runs.push({ text: match[1], bold: true })
    else if (match[2]) runs.push({ text: match[2], italic: true })
    else if (match[3]) runs.push({ text: match[3] })
  }
  return runs.length > 0 ? runs : [{ text }]
}

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = []
  for (const line of markdown.split('\n')) {
    const t = line.trim()
    if (t.startsWith('### ')) blocks.push({ type: 'h3', text: t.slice(4) })
    else if (t.startsWith('## ')) blocks.push({ type: 'h2', text: t.slice(3) })
    else if (t.startsWith('# ')) blocks.push({ type: 'h1', text: t.slice(2) })
    else if (t.startsWith('> ')) blocks.push({ type: 'blockquote', text: t.slice(2) })
    else if (t === '---' || t === '***' || t === '___') blocks.push({ type: 'hr' })
    else if (t.startsWith('- ') || t.startsWith('* ')) blocks.push({ type: 'li', runs: parseInline(t.slice(2)) })
    else if (/^\d+\.\s/.test(t)) blocks.push({ type: 'li', runs: parseInline(t.replace(/^\d+\.\s/, '')) })
    else if (t !== '') blocks.push({ type: 'p', runs: parseInline(t) })
  }
  return blocks
}

// ─── PDF styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  coverPage: {
    padding: 60,
    backgroundColor: '#191654',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  page: {
    padding: '50 60',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  coverTitle: {
    fontSize: 34,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 16,
    lineHeight: 1.2,
  },
  coverSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 40,
  },
  coverBadge: {
    marginTop: 48,
    padding: '12 16',
    backgroundColor: 'rgba(67,198,172,0.2)',
    borderLeftWidth: 3,
    borderLeftColor: '#43C6AC',
  },
  coverBadgeText: {
    fontSize: 10,
    color: '#43C6AC',
    fontFamily: 'Helvetica-Bold',
  },
  h2: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: '#191654',
    marginBottom: 8,
    marginTop: 2,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#43C6AC',
  },
  h3: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#191654',
    marginTop: 12,
    marginBottom: 5,
  },
  p: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.75,
    marginBottom: 7,
    fontFamily: 'Helvetica',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  italic: {
    fontFamily: 'Helvetica-Oblique',
  },
  li: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.75,
    marginBottom: 4,
    paddingLeft: 14,
    fontFamily: 'Helvetica',
  },
  blockquote: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'Helvetica-Oblique',
    borderLeftWidth: 3,
    borderLeftColor: '#43C6AC',
    paddingLeft: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 10,
  },
})

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderRuns(runs: Run[]): React.ReactNode[] {
  return runs.map((run, i) => (
    <Text key={i} style={run.bold ? styles.bold : run.italic ? styles.italic : undefined}>
      {run.text}
    </Text>
  ))
}

function renderBlock(block: Block, i: number): React.ReactNode {
  switch (block.type) {
    case 'h2':
      return <Text key={i} style={styles.h2}>{block.text}</Text>
    case 'h3':
      return <Text key={i} style={styles.h3}>{block.text}</Text>
    case 'p':
      return <Text key={i} style={styles.p}>{renderRuns(block.runs)}</Text>
    case 'li':
      return <Text key={i} style={styles.li}>{'• '}{renderRuns(block.runs)}</Text>
    case 'blockquote':
      return <View key={i} style={styles.blockquote}><Text style={styles.p}>{block.text}</Text></View>
    case 'hr':
      return <View key={i} style={styles.hr} />
    default:
      return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const start = logger.apiStart('/api/generate-pdf')

  const allowed = await checkRateLimit(getIpIdentifier(request), 'pdf', 10, 60)
  if (!allowed) {
    logger.apiEnd('/api/generate-pdf', start, 429)
    return apiError('Rate limit exceeded', 429, 'RATE_LIMITED')
  }

  let body: { markdown: string }
  try {
    body = await request.json()
  } catch {
    logger.apiEnd('/api/generate-pdf', start, 400)
    return apiError('Invalid request body', 400, 'INVALID_BODY')
  }

  const { markdown } = body
  if (!markdown || typeof markdown !== 'string') {
    logger.apiEnd('/api/generate-pdf', start, 400)
    return apiError('markdown required', 400, 'MISSING_FIELD')
  }

  const blocks = parseMarkdown(markdown)

  // Split into sections: first section = cover (h1 + preamble), each h2 = new page
  const sections: Block[][] = []
  let current: Block[] = []
  for (const block of blocks) {
    if (block.type === 'h2' && current.length > 0) {
      sections.push(current)
      current = [block]
    } else {
      current.push(block)
    }
  }
  if (current.length > 0) sections.push(current)

  const coverBlocks = sections[0] ?? []
  const h1Block = coverBlocks.find((b) => b.type === 'h1')
  const coverTitle = h1Block && h1Block.type === 'h1' ? h1Block.text : 'SignalMap'
  const coverParas = coverBlocks.filter((b) => b.type === 'p') as { type: 'p'; runs: Run[] }[]
  const coverSubtitle = coverParas[0]?.runs.map((r) => r.text).join('') ?? ''

  const doc = (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.coverTitle}>{coverTitle}</Text>
          {coverSubtitle ? (
            <Text style={styles.coverSubtitle}>{coverSubtitle}</Text>
          ) : null}
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>Generated by SignalShot · Powered by Alex</Text>
          </View>
        </View>
      </Page>

      {/* One page per ## section */}
      {sections.slice(1).map((section, si) => (
        <Page key={si} size="A4" style={styles.page}>
          {section.map((block, bi) => renderBlock(block, bi))}
        </Page>
      ))}
    </Document>
  )

  const stream = await pdf(doc).toBuffer()

  // Collect Node.js ReadableStream chunks (string | Buffer) into a single Buffer
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk)
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, 'binary'))
    }
  }
  const buffer = Buffer.concat(chunks)

  logger.apiEnd('/api/generate-pdf', start, 200)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="SignalMap.pdf"',
    },
  })
}
