#!/usr/bin/env node
import { Command } from 'commander'
import { runStatus } from './commands/status.js'
import { runDiscover } from './commands/discover.js'
import { runInit } from './commands/init.js'
import { runAdopt } from './commands/adopt.js'
import { runPush } from './commands/push.js'
import { runPull } from './commands/pull.js'
import { runApply } from './commands/apply.js'
import { runSync } from './commands/sync.js'
import { runIgnore } from './commands/ignore.js'

export function createCommand(): Command {
  const cmd = new Command('postman')
    .description('Postman governance for contentlayer3')

  cmd
    .command('status')
    .description('Overview of all sources and their governance state')
    .option('--offline', 'Skip Postman API polling, read lock file only')
    .action(async (opts: { offline?: boolean }) => {
      await runStatus({ offline: opts.offline })
    })

  cmd
    .command('discover')
    .description('Scan config, list unregistered sources')
    .action(async () => {
      await runDiscover()
    })

  cmd
    .command('init')
    .description('Greenfield setup: create Postman collections for all unregistered sources')
    .action(async () => {
      await runInit()
    })

  cmd
    .command('adopt [name]')
    .description('Connect source(s) to existing Postman collections (does not modify Postman)')
    .action(async (name: string | undefined) => {
      await runAdopt(name)
    })

  cmd
    .command('push <name>')
    .description('Promote an unregistered source into Postman (create new collection)')
    .option('--update', 'Update an existing governed collection (requires confirmation)')
    .action(async (name: string, opts: { update?: boolean }) => {
      await runPush(name, { update: opts.update })
    })

  cmd
    .command('pull <name>')
    .description('Fetch Postman spec and show diff vs current — read-only')
    .action(async (name: string) => {
      await runPull(name)
    })

  cmd
    .command('apply <name>')
    .description('After reviewing pull, regenerate local schema and update lock')
    .action(async (name: string) => {
      await runApply(name)
    })

  cmd
    .command('sync')
    .description('Drift check — CI-friendly, exits with meaningful codes')
    .option('--ci', 'CI mode: non-interactive, structured output')
    .action(async (opts: { ci?: boolean }) => {
      await runSync({ ci: opts.ci })
    })

  cmd
    .command('ignore <name>')
    .description('Opt a source out of Postman governance permanently')
    .action(async (name: string) => {
      await runIgnore(name)
    })

  return cmd
}

// Standalone entrypoint
const program = new Command()
program
  .name('contentlayer3 postman')
  .description('Postman governance for contentlayer3')
  .version('1.0.0')

const postmanCmd = createCommand()
for (const sub of postmanCmd.commands) {
  program.addCommand(sub)
}

program.parse()
