<template>
  <div>
    <h3>{{sentence}}</h3>
    <el-row >
      <search v-model="sense"></search>
      <el-button type="primary" :loading="isLoading" v-on:click="fit" style="margin-left: 10px;">Fit</el-button>
      <el-button type="primary" v-bind:disabled="markovProcess===null" v-on:click="generate">Generate</el-button>
    </el-row>
    <graph v-if="markovProcess !== null" :graph="markovProcessGraph"></graph>
  </div>
</template>

<script>
  import Graph from '@/components/Graph'
  import Search from '@/components/Search'
  var perec = require('@/core/perec')
  import {markovProcessWorker} from '@/core/workerclient'

  export default {
    name: 'generator',
    data () {
      return {
        sense: '',
        sentence: 'Pick a theme and click on the fit button to see a constrained Markov process in action',
        isLoading: false,
        markovProcess: null,
        sequence: null
      }
    },
    computed: {
      markovProcessGraph: function () {
        if (this.markovProcess !== null) {
          var g = perec.convertToGraph(this.markovProcess)
          perec.colorSentence(g, this.sequence)
          return g
        }
      }
    },
    methods: {
      fit: function () {
        var vm = this
        vm.markovProcess = null
        vm.sequence = null
        vm.sentence = 'Computing ... '
        vm.isLoading = true
        markovProcessWorker.generate(vm.sense).then(function (markovProcess) {
          // vm.sequence = perec.generate(markovProcess)
          // vm.sentence = perec.represent(vm.sequence)
          vm.markovProcess = markovProcess
          vm.sentence = 'Click on generate to get sentences about ' + vm.sense
          vm.isLoading = false
        })
      },
      generate: function () {
        var vm = this
        if (vm.markovProcess === null) return
        vm.sequence = perec.generate(vm.markovProcess)
        vm.sentence = perec.represent(vm.sequence)
      }
    },
    components: {
      'graph': Graph,
      'search': Search
    }
  }
</script>

<style>
  .input {
    display: inline-block;
    /*width: 130px;*/
  }
</style>
