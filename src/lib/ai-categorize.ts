import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { guessCategory } from '@/lib/categorize'

type TxnInput = {
  id: string
  name: string
  merchantName: string | null | undefined
}

type UserCategory = { id: string; name: string; keywords: string[] }

let client: Anthropic | null | undefined

function getClient(): Anthropic | null {
  if (client !== undefined) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  client = apiKey ? new Anthropic({ apiKey }) : null
  return client
}

/**
 * Categorizes a batch of transactions using Claude, falling back to the local
 * keyword matcher for anything the model can't confidently place (or if the
 * API is unavailable/unset/errors). Never surfaced to the user as "AI" —
 * transactions simply arrive pre-categorized, same as the keyword fallback.
 */
export async function categorizeTransactions(
  transactions: TxnInput[],
  userCategories: UserCategory[],
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  if (transactions.length === 0) return results

  // Nothing to assign to — skip the model call entirely.
  if (userCategories.length === 0) {
    for (const txn of transactions) results.set(txn.id, null)
    return results
  }

  const anthropic = getClient()
  if (!anthropic) {
    for (const txn of transactions) {
      results.set(txn.id, guessCategory(txn.name, txn.merchantName, userCategories))
    }
    return results
  }

  try {
    const categoryList = userCategories.map((c) => `${c.id}: ${c.name}`).join('\n')
    const txnList = transactions
      .map((t) => `${t.id} | ${t.name}${t.merchantName ? ` | ${t.merchantName}` : ''}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              assignments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    transactionId: { type: 'string' },
                    categoryId: { type: ['string', 'null'] },
                  },
                  required: ['transactionId', 'categoryId'],
                  additionalProperties: false,
                },
              },
            },
            required: ['assignments'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: `Categorize each bank transaction below into one of the user's categories, based on the merchant/transaction name. Use your knowledge of common merchants and vendors to make the best judgment call.

Categories (id: name):
${categoryList}

Transactions (id | name | merchant):
${txnList}

For each transaction, return the transactionId and the best-matching categoryId. If nothing fits well, return null for categoryId.`,
        },
      ],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      // max_tokens means the JSON was cut off mid-response — parsing it would
      // throw. Fall back rather than risk a partial/garbled assignment.
      for (const txn of transactions) {
        results.set(txn.id, guessCategory(txn.name, txn.merchantName, userCategories))
      }
      return results
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    const parsed = textBlock && 'text' in textBlock ? JSON.parse(textBlock.text) : null
    const assignments: Array<{ transactionId: string; categoryId: string | null }> =
      parsed?.assignments ?? []

    const validIds = new Set(userCategories.map((c) => c.id))
    const seen = new Set<string>()
    for (const a of assignments) {
      const categoryId = a.categoryId && validIds.has(a.categoryId) ? a.categoryId : null
      results.set(a.transactionId, categoryId)
      seen.add(a.transactionId)
    }

    // Fall back to keyword matching for anything the model didn't return.
    for (const txn of transactions) {
      if (!seen.has(txn.id)) {
        results.set(txn.id, guessCategory(txn.name, txn.merchantName, userCategories))
      }
    }
  } catch (err) {
    console.error('AI categorization error, falling back to keyword matching:', err)
    for (const txn of transactions) {
      results.set(txn.id, guessCategory(txn.name, txn.merchantName, userCategories))
    }
  }

  return results
}
