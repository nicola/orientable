Object.fromEntries = arr => Object.assign({}, ...Array.from(arr, ([k, v]) => ({ [k]: v }) ))

exports.parse = (raw) => {
  raw = raw.replace(/log2\(/g, '(1/log(2))*log(')
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
    assumptions: []
  }

  const curr = { system: [], level: -1 }

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
      } else if (isEq(d)) {
        const systemId = curr.system.join('.')
        const eq = clearEq(d)
        if (eq !== '' && !eq.match(/^ *\/\//g)) {
          systems.constraints.push(eq)
          systems.systems[systemId].push(eq)
        } // it's a comment otherwise
      }
    })

  // Get constraints for each var
  const addVar = (v, d) => {
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
