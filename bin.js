#!/usr/bin/env node
const fs = require('fs')
const orient = require('./index')

require('yargs')
  .command(
    'lint <path>',
    'Lint .orient file',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to file to lint'
      })
    },
    (argv) => {
      console.log('Missing descriptions for: ')
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const model = orient.parse(raw)
      const undescribed = Object.keys(model.descriptions).filter(k => model.descriptions[k].length === 0)
      console.log(undescribed.join('\n'))
      console.log(`\nMissing descriptions for ${undescribed.length} terms`)
    }
  )
  .command(
    'vars <path>',
    'List vars of .orient file',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to file to lint'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const model = orient.parse(raw)
      console.log(JSON.stringify(Object.keys(model.vars), 2, 2))
    }
  )
 .help()
  .argv
