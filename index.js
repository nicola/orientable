const nerdamer = require('nerdamer-fork')
require('nerdamer-fork/Calculus.js')
require('nerdamer-fork/Algebra.js')
require('nerdamer-fork/Solve.js')
require('nerdamer-fork/Extra.js')

Object.fromEntries = arr => Object.assign({}, ...Array.from(arr, ([k, v]) => ({ [k]: v })))

const unrollAssignments = (assignmentsArray) => {
  return assignmentsArray.reduce((acc, curr) => {
    if (Array.isArray(curr)) {
      acc = acc.map(old => curr.map(c => Object.assign({}, old, c))).flat()
    } else {
      acc = acc.map(old => Object.assign({}, old, curr))
    }
    return acc
  }, [{}])
}

exports.solveMultiple = (raw, assignmentSet) => {
  const res = unrollAssignments(assignmentSet)
  return res.map(assignments => solve(raw, assignments))
}

const parse = exports.parse = (raw, flags={}) => {
  raw = raw.replace(/log2\(/g, '(1/log(2))*log(')
  raw = raw.replace(/expt\(2,/g, '2^(')
  const regex = new RegExp('^(( )*[A-Z]+)')
  const dependencyRegex = new RegExp('.*(\\[.*\\])', 'g')
  function isEq (d) { return !d.match(regex) && d !== '' }
  function isSystem (d) { return d.match(regex) && d !== '' }
  function hasDependency (d) { return d.match(dependencyRegex) }
  function cleanSystem (d) { return d.replace(/\[.*\]/g, '').trim() }
  function clearEq (d) { return d.replace(/\/\/.*/g, '').trim() }
  function getDeps (d) { return d.replace(/.*\[/, '').replace(']', '').replace(' ', '').split(',') }
  function getSystem (d) {
    return { system: d.trim(), level: d.search(/\S/) }
  }

  // Extract constraints, systems and variables
  const systems = {
    constraints: [],
    vars: {},
    systems: {},
    dependencies: {},
    descriptions: [],
    assumptions: [],
    flags: []
  }

  systems.flags = Object.keys(flags).filter(d => d[0] === '!').map(d => d.replace('!', ''))

  const curr = { system: [], level: -1, flags: [] }

  raw
    .split('\n')
    .filter(d => d.trim() !== '')
    .forEach(d => {
      if (isSystem(d)) {
        d = d.replace(':', '')
        const { system, level } = getSystem(d)
        if (level > curr.level) {
          curr.system.push(system)
          curr.level = level
        } else if (level === curr.level) {
          curr.system.pop()
          curr.system.push(system)
          curr.level = level
        } else {
          curr.system.pop()
          curr.system.pop()
          curr.system.push(system)
          curr.level = level
        }
        const systemId = curr.system.join('.')
        if (!systems.systems[systemId]) {
          systems.systems[systemId] = []
        }

        const hasDeps = hasDependency(d)
        if (hasDeps) {
          const sys = cleanSystem(d)
          const deps = getDeps(d)
          if (!systems.dependencies[sys]) {
            systems.dependencies[sys] = []
          }
          systems.dependencies[sys] = systems.dependencies[sys].concat(deps)
        }
        curr.flags = curr.system
          .map(d => d.trim().split('('))
          .filter(d => d.length === 2)
          .map(d => d[1]
               .replace(')', '')
               .split(',')
               .map(i => i.trim()))
          .filter(d => d.length !== 0)
      } else if (isEq(d)) {
        const systemId = curr.system.join('.')
        const eq = clearEq(d)
        // Check if current system has a flag that is not set to true
        const hasFlagsPre = curr.flags.flat().map(d => systems.flags.includes(d))
        const hasFlags = hasFlagsPre.every(d => !!d)
        if (hasFlags && eq !== '' && !eq.match(/^ *\/\//g)) {
          systems.constraints.push(eq)
          systems.systems[systemId].push(eq)
        } // it's a comment otherwise
      }
    })

  // Get constraints for each var
  const addVar = (v, d) => {
    if (v === 'log' || v === 'expt') {
      return
    }

    if (!systems.vars[v]) {
      systems.vars[v] = []
    }
    systems.vars[v].push(d)
  }

  systems.constraints.forEach(d => {
    if (d.includes('describe')) {
      const v = d.split(',')[0].replace('describe(', '')
      addVar(v, d)
      return
    }

    const currVars = d.match(/([a-z]+_?)+/g)
    currVars.forEach(v => addVar(v, d))
  })

  systems.assumptions = systems.vars.assume || []
  delete systems.vars.assume
  delete systems.vars.describe
  delete systems.vars.declare

  // Get descriptions for each var
  systems.descriptions = Object.fromEntries(Object.entries(systems.vars).map(([k, v]) => {
    return [k, v.filter(d => d.includes('describe'))]
  }))

  return systems
  // return model.split('\n').map(d => d.trim()).filter(d => !d.match(regex) && d !== '')
}

const solve = exports.solve = (raw, assignments, simplifyTerms) => {
  return solveConstraints(parse(raw, assignments).constraints, assignments, simplifyTerms)
}

const solveConstraints = exports.solveConstraints = (constraints, assignments, simplifyTerms) => solver({ constraints, assignments, simplifyTerms })

function solver (args) {
  // The current solver is very simple:
  // 1. it tries to substitute all the known terms
  // 2. then tries to reduce (simplify) the terms,
  // 3. Repeat from 1 until no new substitutions can be made

  const { constraints, assignments } = args
  const scope = Object.assign({}, assignments)
  const filtered = constraints.filter(d => !d.includes('assume') && !d.includes('declare') && !d.includes('describe'))

  const vars = {}
  constraints
    .filter(d => d.includes('declare'))
    .forEach(d => {
      const tuple = d.replace('declare', '').replace('(', '').replace(')', '').split(',')
      if (tuple.length === 2) {
        const v = tuple[0].trim()
        const val = tuple[1].trim()
        vars[v] = val
      }
    })

  // substitute current known terms
  const subst = d => {
    Object.keys(scope).forEach(v => {
      if (d.variables().includes(v)) {
        d = d.sub(v, scope[v])
      }
    })
    return d
  }

  const reduce = (unsolved, d) => {
    const vars = d.variables()
    if (vars.length === 1) {
      const solFound = d.solveFor(vars[0])
      if (solFound.length === 0) {
        throw Error(`${d.toString()} cannot be solved`)
      }
      const sol = solFound[0].evaluate().text() // TODO eval
      if (scope[vars[0]] && scope[vars[0]] !== sol) {
        throw Error(`we are in trouble, ${vars[0]} ${scope[vars[0]]}, ${sol}`)
      }
      scope[vars[0]] = sol
    } else {
      unsolved.push(d)
    }

    return unsolved
  }

  const step = array => array.map(subst).reduce(reduce, [])

  const run = (array) => {
    let last = Object.keys(scope).length - 1
    while (Object.keys(scope).length !== last) {
      last = Object.keys(scope).length
      array = step(array)
      // if (simplify_terms) {
      //   array = simplifyConstraints(array, simplify_terms)
      //   array = step(array)
      // }
    }
    return array
  }

  const res = run(filtered.map(d => nerdamer(d)))

  return {
    constraints: res.map(d => d.text()).filter(d => d !== '0'),
    assignments: scope,
    vars: vars
  }
}
