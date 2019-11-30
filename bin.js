#!/usr/bin/env node
const fs = require('fs')
const orient = require('./index')

require('yargs')
  .command(
    'lint <path>',
    'Lint .orient file',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to model to lint'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const model = orient.parse(raw)

      const undescribed = Object.keys(model.descriptions).filter(k => model.descriptions[k].length === 0).sort()
      const overdescribed = Object.keys(model.descriptions).filter(k => model.descriptions[k].length > 1).sort()

      // Listing undescribed
      console.log(undescribed.map(d => `Missing describe: ${d}`).join('\n'))
      console.log(overdescribed.map(d => `Too many describe: ${d}`).join('\n'))

      let ok = true
      if (undescribed.length > 0) {
        console.log(`- Missing descriptions for ${undescribed.length} terms`)
        ok = false
      }
      if (overdescribed.length > 0) {
        console.log(`- Too many describe for ${overdescribed.length} terms`)
        ok = false
      }

      if (ok) {
        console.log('All good!')
        return 0
      }
    }
  )
  .command(
    'vars <path>',
    'List vars of .orient file',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to orient model'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const model = orient.parse(raw)
      console.log(JSON.stringify(Object.keys(model.vars), 2, 2))
    }
  )
  .command(
    'solve <path> <assignments>',
    'Find assignments for .orient file and .json assingments',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to orient model'
      })
      yargs.positional('assignments', {
        describe: 'Path to assignments json'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const assignments = JSON.parse(fs.readFileSync(argv.assignments, 'utf-8'))
      console.log(orient.solveMultiple(raw, assignments).map(d => d.assignments))
    }
  )
  .command(
    'unsolved <path> <assignments>',
    'List unresolved equations',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to orient model'
      })
      yargs.positional('assignments', {
        describe: 'Path to assignments json'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const assignments = JSON.parse(fs.readFileSync(argv.assignments, 'utf-8'))
      console.log(orient.solveMultiple(raw, assignments).map(d => d.constraints.join('\n')).join('\n'))
    }
  )
  .strict()
  .help()
  .argv
