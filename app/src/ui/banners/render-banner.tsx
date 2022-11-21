import * as React from 'react'

import { assertNever } from '../../lib/fatal-error'

import { Banner, BannerType } from '../../models/banner'

import { Dispatcher } from '../dispatcher'

import { OpenThankYouCard } from './open-thank-you-card'
import { SuccessBanner } from './success-banner'

export function renderBanner(
  banner: Banner,
  dispatcher: Dispatcher,
  onDismissed: () => void
): JSX.Element {
  switch (banner.type) {
    case BannerType.OpenThankYouCard:
      return (
        <OpenThankYouCard
          key="open-thank-you-card"
          emoji={banner.emoji}
          onDismissed={onDismissed}
          onOpenCard={banner.onOpenCard}
          onThrowCardAway={banner.onThrowCardAway}
        />
      )
    case BannerType.SquashUndone: {
      const pluralized = banner.commitsCount === 1 ? 'commit' : 'commits'
      return (
        <SuccessBanner timeout={5000} onDismissed={onDismissed}>
          Squash of {banner.commitsCount} {pluralized} undone.
        </SuccessBanner>
      )
    }
    case BannerType.SuccessfulReorder: {
      const pluralized = banner.count === 1 ? 'commit' : 'commits'

      return (
        <SuccessBanner
          timeout={15000}
          onDismissed={onDismissed}
          onUndo={banner.onUndo}
        >
          <span>
            Successfully reordered {banner.count} {pluralized}.
          </span>
        </SuccessBanner>
      )
    }
    case BannerType.ReorderUndone: {
      const pluralized = banner.commitsCount === 1 ? 'commit' : 'commits'
      return (
        <SuccessBanner timeout={5000} onDismissed={onDismissed}>
          Reorder of {banner.commitsCount} {pluralized} undone.
        </SuccessBanner>
      )
    }
    default:
      return assertNever(banner as never, `Unknown popup type: ${banner}`)
  }
}
