import { Command } from 'commander'
import pc from 'picocolors'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { transformConfig } from './transforms/config.js'
import { transformNextConfig } from './transforms/next-config.js'
import { transformImports } from './transforms/imports.js'
import { generateReport } from './report.js'
import type { MigrationSummary } from './types.js'

const program = new Command()

program
  .name('contentlayer3-migrate')
  .description('Migrate from contentlayer v1/v2 to Contentlayer3')
  .version('0.1.0')

program
  .command('check')
  .description('Analyze project and show what would change (no writes)')
  .action(() => runMigration({ dryRun: true }))

program
  .command('run')
  .description('Apply all transforms and generate migration report')
  .option('--dry-run', 'Show changes without writing files')
  .action((opts: { dryRun?: boolean }) => runMigration({ dryRun: opts.dryRun ?? false }))

program
  .command('shadow')
  .description('Run both CL3 and original contentlayer and compare output')
  .action(() => {
    console.log(pc.yellow('⚠  Shadow mode is coming soon.'))
    console.log('   It will run both CL3 and contentlayer in parallel and diff the output.')
  })

function findTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    const files: string[] = []
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files.push(...findTsFiles(full))
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        files.push(full)
      }
    }
    return files
  } catch {
    return []
  }
}

function runMigration({ dryRun }: { dryRun: boolean }) {
  const cwd = process.cwd()
  const summary: MigrationSummary = {
    filesModified: [],
    filesChecked: [],
    transformations: [],
    warnings: [],
  }

  console.log(pc.bold('\nContentlayer3 Migration' + (dryRun ? ' (dry run)' : '')))
  console.log(pc.dim('─'.repeat(50)))

  const configPath = join(cwd, 'contentlayer.config.ts')
  if (existsSync(configPath)) {
    const source = readFileSync(configPath, 'utf-8')
    const result = transformConfig(source)
    summary.filesChecked.push('contentlayer.config.ts')
    if (result.transformed) {
      console.log(pc.green('✓') + ' Transformed contentlayer.config.ts → cl3.config.ts')
      summary.transformations.push('contentlayer.config.ts → cl3.config.ts')
      if (!dryRun) {
        writeFileSync(join(cwd, 'cl3.config.ts'), result.output)
        summary.filesModified.push('cl3.config.ts')
      }
    }
    for (const w of result.warnings) {
      const prefix = w.requiresManualReview ? pc.red('✗') : pc.yellow('⚠')
      console.log(`${prefix} contentlayer.config.ts — ${w.message}`)
      summary.warnings.push({ file: 'contentlayer.config.ts', ...w })
    }
  }

  for (const name of ['next.config.ts', 'next.config.js', 'next.config.mjs']) {
    const p = join(cwd, name)
    if (existsSync(p)) {
      const source = readFileSync(p, 'utf-8')
      const result = transformNextConfig(source)
      summary.filesChecked.push(name)
      if (result.transformed) {
        console.log(pc.green('✓') + ` Updated ${name} (removed withContentlayer)`)
        summary.transformations.push(`${name}: removed withContentlayer`)
        if (!dryRun) {
          writeFileSync(p, result.output)
          summary.filesModified.push(name)
        }
      }
    }
  }

  const appFiles = [
    ...findTsFiles(join(cwd, 'app')),
    ...findTsFiles(join(cwd, 'pages')),
    ...findTsFiles(join(cwd, 'src')),
  ]

  for (const file of appFiles) {
    const source = readFileSync(file, 'utf-8')
    if (!source.includes('contentlayer/generated') && !source.includes('contentlayer2/generated')) continue
    const result = transformImports(source)
    const rel = file.replace(cwd + '/', '')
    summary.filesChecked.push(rel)
    for (const w of result.warnings) {
      const loc = w.line ? ` (line ${w.line})` : ''
      console.log(pc.yellow('⚠') + ` ${rel}${loc} — ${w.message}`)
      summary.warnings.push({ file: rel, ...w })
    }
    if (result.transformed && !dryRun) {
      writeFileSync(file, result.output)
      summary.filesModified.push(rel)
    }
  }

  const report = generateReport(summary)
  if (!dryRun) {
    writeFileSync(join(cwd, 'migration-report.md'), report)
    console.log(pc.dim('\n' + '─'.repeat(50)))
    console.log(`\nMigration report written to: ${pc.cyan('migration-report.md')}`)
  } else {
    console.log(pc.dim('\n' + '─'.repeat(50)))
    console.log(pc.dim('\n(dry run — no files written)'))
  }

  const manualCount = summary.warnings.filter((w) => w.requiresManualReview).length
  if (manualCount > 0) {
    console.log(pc.yellow(`\n⚠  ${manualCount} item(s) require manual review. Check migration-report.md`))
  }
}

program.parse()
