'use client'

import { useState, useEffect } from 'react'
import {
  Heart, MessageCircle, Share2, Bookmark,
  ThumbsUp, Send,
  ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react'
import ContentFeedbackWidget from './ContentFeedbackWidget'
import type {
  LinkedInPost, InstagramPost, FacebookPost, ContentFeedbackItem
} from './types'

const UNSPLASH_ACCESS_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

async function fetchUnsplashImage(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.urls?.regular || null
  } catch { return null }
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold w-full justify-center transition-all"
      style={{ backgroundColor: copied ? '#43C6AC' : '#191654' }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy full post'}
    </button>
  )
}

// ── Expanded content panel ────────────────────────────────────────────────────

function ExpandedPanel({
  fields,
  platformReadyText,
}: {
  fields: Array<{ label: string; value: string }>
  platformReadyText: string
}) {
  return (
    <div className="border-t" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
      <div className="p-4 space-y-3">
        {fields.map(({ label, value }) => value ? (
          <div key={label}>
            <p className="text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>
              {label}
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-line"
              style={{ color: '#374151' }}>
              {value}
            </p>
          </div>
        ) : null)}
        <div className="pt-2">
          <CopyBtn text={platformReadyText} />
        </div>
      </div>
    </div>
  )
}

// ── LinkedIn Preview ──────────────────────────────────────────────────────────

function LinkedInPreview({
  post, imageUrl, blockId, contentFeedback, onRate,
}: {
  post: LinkedInPost
  imageUrl: string | null
  blockId: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const truncated = post.hook.length > 120
    ? post.hook.slice(0, 120) + '…'
    : post.hook

  return (
    <div className="rounded-xl overflow-hidden border bg-white w-full"
      style={{ borderColor: '#e0e0e0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#0A66C2' }}>
            B
          </div>
          <div>
            <p className="text-xs font-bold leading-tight" style={{ color: '#000' }}>
              Your Business
            </p>
            <p className="text-xs" style={{ color: '#666' }}>1st · Just now</p>
          </div>
        </div>
        <ContentFeedbackWidget
          blockId={blockId}
          contentText={post.hook}
          contentFeedback={contentFeedback}
          onRate={onRate}
        />
      </div>

      {/* Truncated post text */}
      <div className="px-4 pb-2">
        <p className="text-xs" style={{ color: '#000', lineHeight: 1.5 }}>
          {truncated}
          {post.hook.length > 120 && (
            <span className="font-semibold cursor-pointer"
              style={{ color: '#666' }}> …see more</span>
          )}
        </p>
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual"
          className="w-full object-cover" style={{ height: 200 }} />
      ) : (
        <div className="w-full flex items-center justify-center"
          style={{ height: 200, backgroundColor: '#f3f4f6' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Engagement */}
      <div className="px-4 py-2 border-t" style={{ borderColor: '#e0e0e0' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs" style={{ color: '#666' }}>
            👍 ❤️ 😮 <span className="ml-1">4 reactions</span>
          </p>
          <p className="text-xs" style={{ color: '#666' }}>5 comments</p>
        </div>
        <div className="flex items-center justify-around pt-1 border-t"
          style={{ borderColor: '#e0e0e0' }}>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50" style={{ color: '#666' }}>
            <ThumbsUp size={14} /> Like
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50" style={{ color: '#666' }}>
            <MessageCircle size={14} /> Comment
          </button>
        </div>
      </div>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs" style={{ color: '#0A66C2' }}>
            {post.hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}
          </p>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border-t hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#e0e0e0', color: '#666' }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide full post' : 'See full post'}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <ExpandedPanel
          fields={[
            { label: 'HOOK', value: post.hook },
            { label: 'BODY', value: post.body },
            { label: 'CTA', value: post.cta },
            { label: 'HASHTAGS', value: post.hashtags.map(h => `#${h}`).join(' ') },
          ]}
          platformReadyText={post.platformReadyText ||
            `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`}
        />
      )}
    </div>
  )
}

// ── Instagram Preview ─────────────────────────────────────────────────────────

function InstagramPreview({
  post, imageUrl, blockId, contentFeedback, onRate,
}: {
  post: InstagramPost
  imageUrl: string | null
  blockId: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const truncated = post.hook.length > 100
    ? post.hook.slice(0, 100) + '…'
    : post.hook

  return (
    <div className="rounded-xl overflow-hidden border bg-white w-full"
      style={{ borderColor: '#dbdbdb' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
            B
          </div>
          <p className="text-xs font-bold" style={{ color: '#000' }}>yourbusiness</p>
        </div>
        <ContentFeedbackWidget
          blockId={blockId}
          contentText={post.hook}
          contentFeedback={contentFeedback}
          onRate={onRate}
        />
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual"
          className="w-full object-cover" style={{ height: 240 }} />
      ) : (
        <div className="w-full flex items-center justify-center"
          style={{ height: 240, backgroundColor: '#fafafa' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Heart size={20} style={{ color: '#000' }} />
            <MessageCircle size={20} style={{ color: '#000' }} />
            <Share2 size={20} style={{ color: '#000' }} />
          </div>
          <Bookmark size={20} style={{ color: '#000' }} />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: '#000' }}>247 likes</p>
        <p className="text-xs" style={{ color: '#000', lineHeight: 1.4 }}>
          <span className="font-bold">yourbusiness</span>{' '}
          {truncated}
          {post.hook.length > 100 && (
            <span style={{ color: '#999' }}> more</span>
          )}
        </p>
        {post.hashtags.length > 0 && (
          <p className="text-xs mt-1" style={{ color: '#00376B' }}>
            {post.hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}
          </p>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border-t hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#dbdbdb', color: '#666' }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide full caption' : 'See full caption'}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <ExpandedPanel
          fields={[
            { label: 'HOOK', value: post.hook },
            { label: 'CAPTION', value: post.caption },
            { label: 'CTA', value: post.cta },
            { label: 'HASHTAGS', value: post.hashtags.map(h => `#${h}`).join(' ') },
          ]}
          platformReadyText={post.platformReadyText ||
            `${post.hook}\n\n${post.caption}\n\n${post.cta}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`}
        />
      )}
    </div>
  )
}

// ── Facebook Preview ──────────────────────────────────────────────────────────

function FacebookPreview({
  post, imageUrl, blockId, contentFeedback, onRate,
}: {
  post: FacebookPost
  imageUrl: string | null
  blockId: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden border bg-white w-full"
      style={{ borderColor: '#dddfe2' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#1877F2' }}>
            B
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: '#050505' }}>
              Your Business Page
            </p>
            <p className="text-xs" style={{ color: '#65676B' }}>Just now · 🌐</p>
          </div>
        </div>
        <ContentFeedbackWidget
          blockId={blockId}
          contentText={post.post}
          contentFeedback={contentFeedback}
          onRate={onRate}
        />
      </div>

      {/* Post text */}
      <div className="px-3 pb-2">
        <p className="text-xs" style={{ color: '#050505', lineHeight: 1.5 }}>
          {post.post}
        </p>
        <p className="text-xs font-semibold mt-1" style={{ color: '#1877F2' }}>
          {post.cta}
        </p>
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual"
          className="w-full object-cover" style={{ height: 200 }} />
      ) : (
        <div className="w-full flex items-center justify-center"
          style={{ height: 200, backgroundColor: '#f0f2f5' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Reaction bar */}
      <div className="px-3 py-2 border-t" style={{ borderColor: '#dddfe2' }}>
        <p className="text-xs mb-2" style={{ color: '#65676B' }}>
          👍 ❤️ 😮 · 47 · 12 comments · 5 shares
        </p>
        <div className="flex items-center justify-around pt-1 border-t"
          style={{ borderColor: '#dddfe2' }}>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50" style={{ color: '#65676B' }}>
            <ThumbsUp size={14} /> Like
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50" style={{ color: '#65676B' }}>
            <MessageCircle size={14} /> Comment
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50" style={{ color: '#65676B' }}>
            <Send size={14} /> Share
          </button>
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border-t hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#dddfe2', color: '#65676B' }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Hide full post' : 'See full post'}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <ExpandedPanel
          fields={[
            { label: 'POST', value: post.post },
            { label: 'CTA', value: post.cta },
          ]}
          platformReadyText={post.platformReadyText ||
            `${post.post}\n\n${post.cta}`}
        />
      )}
    </div>
  )
}

// ── Main PostPreviewCard ──────────────────────────────────────────────────────

interface Props {
  pillarIndex: number
  platform: 'linkedin' | 'instagram' | 'facebook'
  post: LinkedInPost | InstagramPost | FacebookPost
  unsplashQuery: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}

export default function PostPreviewCard({
  pillarIndex, platform, post, unsplashQuery, contentFeedback, onRate
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchUnsplashImage(unsplashQuery + ' professional')
      .then(url => setImageUrl(url))
  }, [unsplashQuery])

  const blockId = `pillar_${pillarIndex}_${platform}`

  if (platform === 'linkedin') {
    return (
      <LinkedInPreview post={post as LinkedInPost} imageUrl={imageUrl}
        blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
    )
  }
  if (platform === 'instagram') {
    return (
      <InstagramPreview post={post as InstagramPost} imageUrl={imageUrl}
        blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
    )
  }
  return (
    <FacebookPreview post={post as FacebookPost} imageUrl={imageUrl}
      blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
  )
}
