'use client'

import { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, ThumbsUp } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import ContentFeedbackWidget from './ContentFeedbackWidget'
import type { LinkedInPost, InstagramPost, FacebookPost, ContentFeedbackItem } from './types'

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
  const truncatedHook = post.hook.length > 150
    ? post.hook.slice(0, 150) + '…'
    : post.hook

  return (
    <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: '#e0e0e0', maxWidth: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#0A66C2' }}>
            B
          </div>
          <div>
            <p className="text-xs font-bold leading-tight" style={{ color: '#000' }}>Your Business</p>
            <p className="text-xs" style={{ color: '#666' }}>1st · Just now</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ContentFeedbackWidget blockId={blockId} contentText={post.hook} contentFeedback={contentFeedback} onRate={onRate} />
          <CopyButton text={`${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`} variant="button" label="Copy" />
        </div>
      </div>

      {/* Post text */}
      <div className="px-4 pb-2">
        <p className="text-xs" style={{ color: '#000', lineHeight: 1.5 }}>
          {truncatedHook}
          {post.hook.length > 150 && (
            <span className="font-semibold cursor-pointer" style={{ color: '#666' }}> …see more</span>
          )}
        </p>
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual" className="w-full object-cover" style={{ height: 220 }} />
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: 220, backgroundColor: '#f3f4f6' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Engagement bar */}
      <div className="px-4 py-2 border-t" style={{ borderColor: '#e0e0e0' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs" style={{ color: '#666' }}>👍 ❤️ 247 · 18 comments</p>
          <p className="text-xs" style={{ color: '#666' }}>12 reposts</p>
        </div>
        <div className="flex items-center justify-around pt-1 border-t" style={{ borderColor: '#e0e0e0' }}>
          {['Like', 'Comment', 'Repost', 'Send'].map(action => (
            <button key={action} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded"
              style={{ color: '#666' }}>
              <ThumbsUp size={13} /> {action}
            </button>
          ))}
        </div>
      </div>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-xs" style={{ color: '#0A66C2' }}>
            {post.hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}
          </p>
          <CopyButton text={post.hashtags.map(h => `#${h}`).join(' ')} />
        </div>
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
  const truncatedCaption = post.hook.length > 125
    ? post.hook.slice(0, 125) + '…'
    : post.hook

  return (
    <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: '#dbdbdb', maxWidth: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            B
          </div>
          <p className="text-xs font-bold" style={{ color: '#000' }}>yourbusiness</p>
        </div>
        <div className="flex items-center gap-1">
          <ContentFeedbackWidget blockId={blockId} contentText={post.hook} contentFeedback={contentFeedback} onRate={onRate} />
          <CopyButton text={`${post.caption}\n\n${post.cta}\n\n${post.hashtags.map(h => `#${h}`).join(' ')}`} variant="button" label="Copy" />
        </div>
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual" className="w-full object-cover" style={{ height: 280 }} />
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: 280, backgroundColor: '#fafafa' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Heart size={22} style={{ color: '#000' }} />
            <MessageCircle size={22} style={{ color: '#000' }} />
            <Share2 size={22} style={{ color: '#000' }} />
          </div>
          <Bookmark size={22} style={{ color: '#000' }} />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: '#000' }}>247 likes</p>
        <p className="text-xs" style={{ color: '#000', lineHeight: 1.4 }}>
          <span className="font-bold">yourbusiness</span>{' '}
          {truncatedCaption}
          {post.hook.length > 125 && (
            <span style={{ color: '#999' }}> more</span>
          )}
        </p>
        {post.hashtags.length > 0 && (
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: '#00376B' }}>
              {post.hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}
            </p>
            <CopyButton text={post.hashtags.map(h => `#${h}`).join(' ')} />
          </div>
        )}
      </div>
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
  return (
    <div className="rounded-xl overflow-hidden border bg-white" style={{ borderColor: '#dddfe2', maxWidth: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#1877F2' }}>
            B
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: '#050505' }}>Your Business Page</p>
            <p className="text-xs" style={{ color: '#65676B' }}>Just now · 🌐</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ContentFeedbackWidget blockId={blockId} contentText={post.post} contentFeedback={contentFeedback} onRate={onRate} />
          <CopyButton text={`${post.post}\n\n${post.cta}`} variant="button" label="Copy" />
        </div>
      </div>

      {/* Post text */}
      <div className="px-3 pb-2">
        <p className="text-xs" style={{ color: '#050505', lineHeight: 1.5 }}>{post.post}</p>
        <p className="text-xs font-semibold mt-1" style={{ color: '#1877F2' }}>{post.cta}</p>
      </div>

      {/* Image */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Post visual" className="w-full object-cover" style={{ height: 220 }} />
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: 220, backgroundColor: '#f0f2f5' }}>
          <p className="text-xs" style={{ color: '#9ca3af' }}>Add your image here</p>
        </div>
      )}

      {/* Reaction bar */}
      <div className="px-3 py-2 border-t" style={{ borderColor: '#dddfe2' }}>
        <p className="text-xs mb-2" style={{ color: '#65676B' }}>👍 ❤️ 😮 · 47 · 12 comments · 5 shares</p>
        <div className="flex items-center justify-around pt-1 border-t" style={{ borderColor: '#dddfe2' }}>
          {[{ icon: ThumbsUp, label: 'Like' }, { icon: MessageCircle, label: 'Comment' }, { icon: Share2, label: 'Share' }].map(({ icon: Icon, label }) => (
            <button key={label} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded"
              style={{ color: '#65676B' }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main PostPreviewCard ──────────────────────────────────────────────────────

interface PostPreviewCardProps {
  pillarIndex: number
  platform: 'linkedin' | 'instagram' | 'facebook'
  post: LinkedInPost | InstagramPost | FacebookPost
  unsplashQuery: string
  contentFeedback: Record<string, ContentFeedbackItem>
  onRate: (item: ContentFeedbackItem) => void
}

export default function PostPreviewCard({ pillarIndex, platform, post, unsplashQuery, contentFeedback, onRate }: PostPreviewCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchUnsplashImage(unsplashQuery + ' professional').then(url => setImageUrl(url))
  }, [unsplashQuery])

  const blockId = `pillar_${pillarIndex}_${platform}`

  if (platform === 'linkedin') {
    return <LinkedInPreview post={post as LinkedInPost} imageUrl={imageUrl} blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
  }
  if (platform === 'instagram') {
    return <InstagramPreview post={post as InstagramPost} imageUrl={imageUrl} blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
  }
  return <FacebookPreview post={post as FacebookPost} imageUrl={imageUrl} blockId={blockId} contentFeedback={contentFeedback} onRate={onRate} />
}
