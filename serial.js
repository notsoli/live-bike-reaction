const Serial = {
  state: {
    resolution: [window.innerWidth, window.innerHeight],
    frame: 0,
    acceleration: {x: 0, y: 0, z: 0},
    speed: 0,
    jerk: 0,
    time_since_jerk: 50,
    temperature: 0,
    screen_brightness: 0,
    volume: 0,
    normalized_volume: 0
  },
  port: undefined,
  async init() {
    if ("serial" in navigator) {
      this.port = await navigator.serial.requestPort()
      await this.port.open({ baudRate: 9600 })
      console.log("Serial stated.")
      Serial.start()
    } else {
      console.warning("Serial is not supported.")
    }
  },

  async start() {
    while (this.port.readable) {
      const reader = this.port.readable.getReader()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) { break }

          // decode serial message
          let msg = ""
          for (let i = 0; i < value.length; i++) {
            msg = msg.concat(String.fromCharCode(value[i]))
          }

          // udpate state based on message
          Serial.udpate_state(msg)
        }
      } catch (error) {
        console.error(error)
      } finally {
        reader.releaseLock()
      }
    }

    console.log("Serial stopped.")
  },
  udpate_state(msg) {
    switch (msg.charAt(0)) {
      case "x":
        this.state.acceleration.x = parseFloat(msg.substring(1))
        break
      case "y":
        this.state.acceleration.y = parseFloat(msg.substring(1))
        break
      case "z":
        this.state.acceleration.z = parseFloat(msg.substring(1))
        break
      case "t":
        this.state.temperature = parseFloat(msg.substring(1))
        break
      case "v":
        this.state.volume = parseFloat(msg.substring(1))
        break
    }
  }
}

export default Serial
