export interface LinkedInPost {
  hook: string
  body: string
  cta: string
  hashtags: string[]
  charCount: number
  platformReadyText: string
}

export interface InstagramPost {
  hook: string
  caption: string
  cta: string
  hashtags: string[]
  charCount: number
  platformReadyText: string
}

export interface FacebookPost {
  post: string
  cta: string
  charCount: number
  platformReadyText: string
}

export interface Pillar {
  name: string
  theme: string
  icpConnection: string
  unsplashQuery: string
  posts: {
    linkedin?: LinkedInPost
    instagram?: InstagramPost
    facebook?: FacebookPost
  }
}

export interface CalendarEntry {
  day: string
  platform: string
  pillar: string
  postType: string
  scheduledDate: string | null
}

export interface ReelSegment { timeCode: string; script: string; visualNote: string }
export interface ReelScript {
  pillar: string
  totalDuration: string
  hook: string
  segments: ReelSegment[]
  cta: string
  captionSuggestion: string
}

export interface CarouselSlide {
  slideNumber: number
  headline: string
  bodyText: string
  visualNote: string
}
export interface CarouselFramework {
  pillar: string
  slideCount: number
  coverSlide: { headline: string; subtext: string }
  slides: CarouselSlide[]
  closingSlide: { cta: string; text: string }
}

export interface StoryFrame {
  frameNumber: number
  text: string
  visualNote: string
  stickerSuggestion: string
}
export interface StorySequence {
  pillar: string
  frameCount: number
  frames: StoryFrame[]
}

export interface StrategySignals {
  primaryTheme: string
  whyItWins: string
  dataSourcesUsed: string[]
  contentMix: string
  postingRationale: string
  platformNotes: string
  testingRecommendations: string[]
}

export interface ContentOutput {
  strategySignals?: StrategySignals
  pillars?: Pillar[]
  hooks?: string[]
  contentCalendar?: {
    week1: CalendarEntry[]
    week2: CalendarEntry[]
    week3: CalendarEntry[]
    week4: CalendarEntry[]
  }
  reelScripts?: ReelScript[]
  carouselFrameworks?: CarouselFramework[]
  storySequences?: StorySequence[]
}

export interface ContentFeedbackItem {
  blockId: string
  contentText: string
  rating: number
  reasons: string[]
}

export interface BonusContext {
  pillarNames: string[]
  platforms: string[]
  postingFrequency: string
  contentGoal: string
  tone: string
  businessName: string
  primaryService: string
  condensedContext?: string
}
