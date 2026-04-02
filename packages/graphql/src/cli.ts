#!/usr/bin/env node
import { Command } from 'commander'
import { runGenerate } from './commands/generate.js'
import { runPrint } from './commands/print.js'
import { runValidate } from './commands/validate.js'

const program = new Command()

program
  .name('contentlayer3 graphql')
  .description('GraphQL API plugin for contentlayer3')
  .version('1.0.0')

program
  .command('generate')
  .description('Generate .contentlayer3/generated/schema.graphql from your collections')
  .action(async () => {
    await runGenerate()
  })

program
  .command('print')
  .description('Print the GraphQL SDL to stdout')
  .action(async () => {
    await runPrint()
  })

program
  .command('validate')
  .description('Validate the GraphQL schema for structural errors')
  .action(async () => {
    await runValidate()
  })

program.parse()
