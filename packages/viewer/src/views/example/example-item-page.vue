<template>
  <div class="example-detail">
    <div class="example-viewer">
      <div class="example-title">
        <h1>{{example.title}}</h1>

        <div>
          <button>view code</button>

          <button @click="showConfig = !showConfig">
            config panel
            <font-awesome-icon v-if="showConfig" icon="minus-square" />
          </button>

          <div class="config-panel" v-if="config && showConfig">
            <Config :config="config" />
          </div>
        </div>
      </div>

      <div class="canvas-wrap">
        <canvas></canvas>
        <div v-if="!exampleHasBuild">example is in building</div>
      </div>

      <div v-if="exampleHasBuild" class="control-panel">
        <button class="btn" v-if="!isRunning" @click="start">
          <font-awesome-icon icon="play" />
        </button>
        <button class="btn" v-if="isRunning" @click="stop">
          <font-awesome-icon icon="stop" />
        </button>
        <button class="btn" @click="step" v-if="!isRunning">
          <font-awesome-icon icon="step-forward" />
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { TestBridge } from "../../../../example/src/test-bridge";
import Config from "../../components/conf/config.vue";
import { RenderConfig } from "../../components/conf/interface";

const bridge = new TestBridge();

@Component({
  components: { Config }
})
export default class ConfigPanel extends Vue {
  $store: any;
  $router: any;
  $route: any;

  showConfig: boolean = true;

  config: RenderConfig = {
    name: "example config",
    type: "folder",
    value: []
  };

  get example() {
    this.$store.state.viewExample = this.$route.params.name;
    for (let i = 0; i < this.$store.state.examples.length; i++) {
      const example = this.$store.state.examples[i];
      if (example.name === this.$store.state.viewExample) {
        return example;
      }
    }
    throw "cant find example";
  }

  exampleHasBuild: boolean = false;
  isRunning: boolean = false;

  start() {
    bridge.framer.run();
    this.isRunning = true;
  }

  stop() {
    bridge.framer.stop();
    this.isRunning = false;
  }

  step() {
    bridge.framer.step();
  }

  keyboardToggle(e: KeyboardEvent) {
    if (e.code === "Space") {
      if (!this.isRunning) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  async mounted() {
    bridge.reset(this.$el.querySelector("canvas")!);

    await this.example.build(bridge);

    if (bridge.testConfig !== undefined) {
      if (Array.isArray(bridge.testConfig)) {
        this.config.value = this.config.value.concat(bridge.testConfig);
      } else {
        this.config.value.push(bridge.testConfig);
      }
    }

    this.exampleHasBuild = true;

    window.addEventListener("keydown", this.keyboardToggle);
  }

  beforeDestroy() {
    window.removeEventListener("keydown", this.keyboardToggle);
  }
}
</script>


<style lang="scss" scoped>
.example-detail {
  border-top: 1px solid #eee;
  width: 100%;
  height: calc(100vh - 40px);

  display: flex;
}

.example-viewer {
  flex-grow: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.canvas-wrap {
  flex-grow: 1;
  height: 500px;
}

canvas {
  width: 100%;
  height: 100%;

  border: 1px solid #aaa;
}

.example-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  > h1 {
    margin: 5px;
  }
  border-bottom: #eee;

  button {
    height: 30px;
    margin: 3px;
    background: #444;
    border: 0px;
    border-radius: 3px;
    color: #fff;
  }
}

.config-panel {
  position: absolute;
  right: 0px;
  top: 100%;
}

.control-panel {
  min-height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eee;

  > .btn {
    padding: 5px;
    margin: 3px;
    border-radius: 3px;
    border: 0px;
    background: #ddd;
    cursor: pointer;

    &:hover {
      background: #fff;
    }

    &:active {
      background: #eee;
    }
  }
}
</style>
