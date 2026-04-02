import type { TransformResult, Warning } from '../types.js'

export function transformNextConfig(source: string): TransformResult {
  const warnings: Warning[] = []
  let output = source
  let transformed = false

  // Remove withContentlayer import line
  const newOutput1 = output.replace(
    /import\s*\{[^}]*withContentlayer[^}]*\}\s*from\s*['"]next-contentlayer['"]\s*\n?/g,
    ''
  )
  if (newOutput1 !== output) {
    output = newOutput1
    transformed = true
  }

  // Remove withContentlayer() wrapping, keep inner config
  const newOutput2 = output.replace(/withContentlayer\s*\(\s*([\s\S]*?)\s*\)/g, '$1')
  if (newOutput2 !== output) {
    output = newOutput2
    transformed = true
  }

  // Add note at top if we made changes
  if (transformed) {
    output = `// No next.config changes needed. CL3 is runtime-first.\n` + output
  }

  return { transformed, output, warnings }
}
