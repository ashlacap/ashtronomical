export type CategoryMatch = { categoryId: string; score: number }

const DEFAULT_KEYWORD_MAP: Record<string, string[]> = {
  Housing: ['rent', 'mortgage', 'hoa', 'property'],
  Groceries: ['grocery', 'groceries', 'whole foods', 'trader joe', 'kroger', 'safeway', 'walmart', 'target', 'costco', 'aldi', 'publix', 'wegmans'],
  Dining: ['restaurant', 'doordash', 'ubereats', 'grubhub', 'mcdonald', 'starbucks', 'chipotle', 'subway', 'pizza', 'burger', 'taco', 'cafe', 'coffee', 'diner'],
  Transportation: ['uber', 'lyft', 'gas', 'fuel', 'parking', 'toll', 'metro', 'transit', 'shell', 'chevron', 'exxon', 'bp', 'speedway'],
  Utilities: ['electric', 'water', 'gas bill', 'internet', 'comcast', 'att', 'verizon', 'spectrum', 'pge', 'con ed', 'duke energy'],
  Subscriptions: ['netflix', 'hulu', 'disney', 'spotify', 'apple', 'amazon prime', 'hbo', 'youtube', 'microsoft', 'adobe', 'dropbox'],
  Healthcare: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'dental', 'vision', 'medical', 'health'],
  Entertainment: ['movie', 'theater', 'concert', 'ticketmaster', 'steam', 'playstation', 'xbox', 'nintendo', 'amc'],
  Shopping: ['amazon', 'ebay', 'etsy', 'nordstrom', 'macys', 'gap', 'h&m', 'zara', 'nike', 'best buy', 'apple store'],
}

export function guessCategory(
  transactionName: string,
  merchantName: string | null | undefined,
  userCategories: Array<{ id: string; name: string; keywords: string[] }>,
): string | null {
  const haystack = `${transactionName} ${merchantName ?? ''}`.toLowerCase()

  // First try user's own category keywords
  let bestMatch: { id: string; score: number } | null = null
  for (const cat of userCategories) {
    for (const kw of cat.keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        if (!bestMatch || kw.length > bestMatch.score) {
          bestMatch = { id: cat.id, score: kw.length }
        }
      }
    }
  }
  if (bestMatch) return bestMatch.id

  // Fall back to default keyword map — match by category name
  for (const [catName, keywords] of Object.entries(DEFAULT_KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (haystack.includes(kw)) {
        const matched = userCategories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase(),
        )
        if (matched) return matched.id
      }
    }
  }

  return null
}
