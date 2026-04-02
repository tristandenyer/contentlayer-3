#!/usr/bin/env node
import { Command } from 'commander'
import { loadCL3Config } from './loader.js'
import { runInspect } from './commands/inspect.js'
import { runValidate } from './commands/validate.js'
import { runWatch } from './commands/watch.js'

const program = new Command()

program
  .name('cl3')
  .description('CL3 devtools CLI')
  .version('0.1.0')

program
  .command('inspect [collection]')
  .description('Print collection summary (schema, item count, cache status)')
  .option('-c, --config <path>', 'Path to cl3.config.ts/js')
  .action(async (collection: string | undefined, opts: { config?: string }) => {
    const { collections } = await loadCL3Config(opts.config)
    await runInspect(collections, collection)
  })

program
  .command('validate')
  .description('Run all collections and report validation errors')
  .option('-c, --config <path>', 'Path to cl3.config.ts/js')
  .action(async (opts: { config?: string }) => {
    const { collections } = await loadCL3Config(opts.config)
    const hasErrors = await runValidate(collections)
    if (hasErrors) process.exit(1)
  })

program
  .command('watch')
  .description('Watch content dirs and re-validate on changes')
  .option('-c, --config <path>', 'Path to cl3.config.ts/js')
  .action(async (opts: { config?: string }) => {
    const { collections } = await loadCL3Config(opts.config)
    await runWatch(collections)
  })

// Dynamic — only if installed
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postman = await import('@contentlayer3/postman/cli' as string) as any
  program.addCommand(postman.createCommand())
} catch {
  // @contentlayer3/postman not installed — postman commands unavailable
}

program.parse()
