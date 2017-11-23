var _ = require('lodash')
var PD = require('probability-distributions')

function computeAlphas (matrix) {
  return _.mapValues(matrix, probabilities => _.sum(_.values(probabilities)))
}

function normalizeValues (values, alpha) {
  return _.mapValues(values, v => v / alpha)
}

function normalize (matrix, alphas) {
  if (alphas === undefined) {
    alphas = computeAlphas(matrix)
  }
  return _.mapValues(matrix, (probabilities, prefix) =>
    normalizeValues(probabilities, alphas[prefix])
  )
}

function update (matrix, prefix, suffix) {
  if (matrix[prefix] === undefined) {
    matrix[prefix] = {}
  }

  if (matrix[prefix][suffix] === undefined) {
    matrix[prefix][suffix] = 0
  }
  matrix[prefix][suffix] += 1
}

function getTransitionMatrix (sequence, order = 1) {
  var m = {}
  // var sequence = _.map(seq, w => _.replace(w, /\./g, '*'))
  for (var index = order; index < sequence.length; index++) {
    var prefix = sequence.slice(index - order, index)
    var suffix = sequence[index]
    update(m, prefix, suffix)
  }
  return m
}

function mergeTransitionProbabilities (probabilities1, probabilities2) {
  // Here the undefined return in the lambda sum is needed by mergeWith to work properly
  return _.mergeWith(
    probabilities1,
    probabilities2,
    (v1, v2) => (v1 ? v1 + v2 : undefined)
  )
}

function mergeTransitionMatrix (matrix1, matrix2) {
  return _.mergeWith(matrix1, matrix2, mergeTransitionProbabilities)
}

function parseSequencesForOrder (sequences, order) {
  var matrix = _.map(sequences, seq => getTransitionMatrix(seq, order)).reduce(
    mergeTransitionMatrix
  )
  return normalize(matrix)
}

function parseSequences (sequences, maxOrder) {
  return _.range(maxOrder + 1).map(order =>
    parseSequencesForOrder(sequences, order)
  )
}

function filterValues (matrix, values) {
  if (values === null || values === undefined) {
    return matrix
  }

  var filtered = _.mapValues(matrix, probabilities =>
    _.pick(probabilities, values)
  )
  return _.omitBy(filtered, _.isEmpty)
}

function selectAlpha (suffix, prefix, alphas) {
  var split = _.split(prefix, ',')
  var index = _.tail(split)
  index.push(suffix)

  if (!(index in alphas)) {
    // Maybe is back-propagating to a smaller order, try to use the whole prefix as index
    index = split
    index.push(suffix)
  }

  return alphas[index]
}

function updateProbabilities (probabilities, prefix, alphas) {
  var updated = _.mapValues(
    probabilities,
    (value, suffix) => value * selectAlpha(suffix, prefix, alphas)
  )
  return _.omitBy(updated, _.isNaN)
}

function propagateAlphas (matrix, alphas) {
  if (alphas === undefined || alphas === null) {
    return matrix
  }
  var updated = _.mapValues(matrix, (probabilities, prefix) =>
    updateProbabilities(probabilities, prefix, alphas)
  )
  return _.omitBy(updated, _.isEmpty)
}

function getMarkovProcess (matrices, constraints) {
  var alphas
  var maxOrder = matrices.length - 1
  var markovProcess = []
  for (var index = constraints.length - 1; index >= 0; index--) {
    var values = constraints[index]
    var matrix = matrices[_.min([index, maxOrder])]
    var filtered = propagateAlphas(filterValues(matrix, values), alphas)
    if (_.isEmpty(filtered)) {
      throw new Error(
        'The constraints satisfaction problem has no solution. Try to relax your constraints'
      )
    }
    alphas = computeAlphas(filtered)
    markovProcess.unshift(normalize(filtered, alphas))
  }
  return markovProcess
}

function sample (probabilities) {
  return PD.sample(_.keys(probabilities), 1, true, _.values(probabilities))[0]
}

function generate (markovProcess, order) {
  var sequence = []
  for (var index = 0; index < markovProcess.length; index++) {
    var matrix = markovProcess[index]
    var prefix = _.takeRight(sequence, _.min([index, order]))
    var probabilities = matrix[prefix]
    sequence.push(sample(probabilities))
  }
  return sequence
}

function locate (index, total) {
  if (total === 1) return 0.5
  return index / (total - 1)
}

function convertToD3 (markovProcess, order) {
  if (markovProcess === null) return
  var graph = {nodes: [{'id': '<s>', 'x': 0, 'y': 0.5}], links: []}
  var nodes = graph.nodes
  for (var i = 1; i < markovProcess.length - 1; i++) {
    var matrix = markovProcess[i]

    var links = _.flatten(_.map(nodes, function (node) {
      var prefix = node.id
      var suffixes = _.keys(matrix[prefix])
      return _.map(suffixes, function (suffix) {
        var transition = _.concat(_.split(prefix, ','), suffix)
        var target = _.join(_.takeRight(transition, order), ',')
        return {'source': prefix, 'target': target, 'value': matrix[prefix][suffix]}
      })
    }))
    graph.links = _.concat(graph.links, links)

    var nodeIds = _.uniq(_.map(links, link => link.target))
    nodes = _.map(nodeIds, function (node, j) {
      return {'id': node, 'x': locate(i, markovProcess.length), 'y': locate(j, nodeIds.length)}
    })
    graph.nodes = _.concat(graph.nodes, nodes)
  }
  var ids = _.fromPairs(_.map(graph.nodes, node => [node.id, node]))
  _.map(graph.links, function (link, id) {
    var source = ids[link.source]
    var target = ids[link.target]
    link.id = id
    link.x0 = source.x
    link.y0 = source.y
    link.x1 = target.x
    link.y1 = target.y
  })
  return graph
}

var markov = {
  parseSequences: parseSequences,
  getMarkovProcess: getMarkovProcess,
  generate: generate,
  convertToD3: convertToD3
}

module.exports = markov
