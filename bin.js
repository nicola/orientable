#!/usr/bin/env node
const fs = require('fs')
const orient = require('./index')
const path = require('path')

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
    'unsolved <path> <assignments> [branch]',
    'List unresolved equations',
    (yargs) => {
      yargs.positional('path', {
        describe: 'Path to orient model'
      })
      yargs.positional('assignments', {
        describe: 'Path to assignments json'
      })
      yargs.positional('branch', {
        describe: 'Index of solution branch'
      })
    },
    (argv) => {
      const raw = fs.readFileSync(argv.path, 'utf-8')
      const assignments = JSON.parse(fs.readFileSync(argv.assignments, 'utf-8'))
      const sols = orient.solveMultiple(raw, assignments)
      if (argv.branch >= sols.length) {
        console.log('Not enough solution branches')
        return
      }
      const res = sols
            .map(d => d.constraints.join('\n'))[argv.branch || 0]
            .replace(/=/g, ' = ')
            .replace(/\*/g, ' * ')
            .replace(/\//g, ' / ')
            .replace(/-/g, ' - ')
            .replace(/\+/g, ' + ')

      console.log(res)
    }
  )
  .command(
    'serve <port> [path]',
    'Serve the solver on a model',
    (yargs) => {
      yargs.positional('port', {
        describe: 'Port of the http server'
      })
      yargs.positional('path', {
        describe: 'Path to model folder'
      })
    },
    (argv) => {
      const express = require('express')
      const app = express()
      const port = argv.port
      const model = fs.readFileSync(argv.path, 'utf-8')

      app.use(express.json());
      app.set('json spaces', 2);
      app.post('/', (req, res) => {
        res.send(orient.solve(model, req.body))
      })

      app.listen(port, () => {
        console.log(`Simple Orientable server listening on port ${port}!`)
        console.log(`Model at: ${argv.path}`)
      })
    }
  )
  .strict()
  .help()
  .argv
