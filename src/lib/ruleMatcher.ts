import type { DomainRule } from './types'

interface CompiledRule {
  enabled: boolean
  test: (url: string) => boolean
}

interface CompiledCache {
  compiled: CompiledRule[]
  rawEnabledCount: number
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
}

export function compileRules(rules: DomainRule[]): CompiledCache {
  const enabled = rules.filter(r => r.enabled)
  return {
    compiled: enabled.map(rule => {
      if (rule.type === 'regex') {
        try {
          const re = new RegExp(rule.pattern, 'i')
          return { enabled: true, test: (url: string) => re.test(url) }
        } catch {
          return { enabled: true, test: () => false }
        }
      } else {
        const re = wildcardToRegex(rule.pattern)
        return { enabled: true, test: (url: string) => re.test(url) }
      }
    }),
    rawEnabledCount: enabled.length,
  }
}

export function matchUrl(url: string, cache: CompiledCache): boolean {
  if (cache.rawEnabledCount === 0) return true
  return cache.compiled.some(rule => rule.test(url))
}

export function matchUrlDirect(url: string, rules: DomainRule[]): boolean {
  const enabled = rules.filter(r => r.enabled)
  if (enabled.length === 0) return true

  return enabled.some(rule => {
    try {
      return rule.type === 'regex'
        ? new RegExp(rule.pattern, 'i').test(url)
        : wildcardToRegex(rule.pattern).test(url)
    } catch {
      return false
    }
  })
}
