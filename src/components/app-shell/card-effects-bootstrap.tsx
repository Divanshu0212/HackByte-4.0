'use client'

import { useEffect } from 'react'

const CARD_SELECTOR = '[data-elixa-card]'

function prepareCard(element: HTMLElement, observer: IntersectionObserver) {
  if (element.dataset.scrollPrepared === 'true') {
    return
  }

  element.dataset.scrollPrepared = 'true'

  const rect = element.getBoundingClientRect()
  const shouldStartVisible = rect.top <= window.innerHeight * 0.9

  element.dataset.scrollReveal = shouldStartVisible ? 'visible' : 'hidden'

  if (!shouldStartVisible) {
    observer.observe(element)
  }
}

function prepareTree(root: ParentNode, observer: IntersectionObserver) {
  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((element) => {
      prepareCard(element, observer)
    })
  }
}

export function CardEffectsBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }

          const element = entry.target as HTMLElement
          element.dataset.scrollReveal = 'visible'
          observer.unobserve(element)
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -10% 0px',
      }
    )

    prepareTree(document, observer)

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return
          }

          if (node.matches(CARD_SELECTOR)) {
            prepareCard(node, observer)
          }

          prepareTree(node, observer)
        })
      })
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  return null
}
