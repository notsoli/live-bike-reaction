import { default as seagulls } from './seagulls.js'
import { default as Video } from './video.js'
import { default as Serial } from './serial.js'
import {Pane} from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.1/dist/tweakpane.min.js'

let video_canvas, video_ctx, ui

document.addEventListener('keydown', async (e) => {
    if (e.key == " ") {
        const text = document.querySelector("h1")
        text.innerHTML = "loading..."
        await Video.init()
        await Serial.init()
        await sg_init()
        text.style.display = "none"
    } else if (e.key == "h") {
        if (ui.containerElem_.style.display == "block") {
            ui.containerElem_.style.display = "none"
        } else {
            ui.containerElem_.style.display = "block"
        }
    }
})

async function sg_init() {
    const state = Serial.state

    const config = {
        BRIGHT_LOW: 0.6,
        BRIGHT_HIGH: 0.8,
        SPEED_THRESHOLD: 13,
        JERK_TRIGGER: 40,
        VOLUME_TRIGGER: 150
    }

    ui = new Pane()
    ui.addBinding(config, 'BRIGHT_LOW',{
        min:0.0,
        max:1.0,
        step:0.05
    })
    ui.addBinding(config, 'BRIGHT_HIGH',{
        min:0.0,
        max:1.0,
        step:0.05
    })
    ui.addBinding(config, 'SPEED_THRESHOLD',{
        min:10,
        max:25,
        step:0.1
    })
    ui.addBinding(config, 'JERK_TRIGGER',{
        min:10,
        max:50,
        step:0.5
    })
    ui.addBinding(config, 'VOLUME_TRIGGER',{
        min:0,
        max:300,
        step:10
    })

    const sg = await seagulls.init(),
        frag = await seagulls.import( './frag.wgsl' ),
        shader = seagulls.constants.vertex + frag
       
    // allow us to read video data directly
    video_canvas = document.createElement("canvas")
    video_ctx = video_canvas.getContext("2d", {willReadFrequently: true})
    video_canvas.width = Video.element.videoWidth
    video_canvas.height = Video.element.videoHeight 

    // set up seagulls
    sg
        .uniforms({ frame: state.frame, resolution: state.resolution, screen_brightness: state.screen_brightness,
        speed: state.speed, jerk: state.jerk, time_since_jerk: state.time_since_jerk, volume: state.normalized_volume,
        bright_low: config.BRIGHT_LOW, bright_high: config.BRIGHT_HIGH })
        .onframe( () => {
            sg.uniforms.frame = state.frame++

            // calculate camera feed brightness
            video_ctx.drawImage(Video.element, 0, 0)
            const image_data = video_ctx.getImageData(0, 0, video_canvas.width, video_canvas.height)
            let total_brightness = 0
            for (let i = 0; i < image_data.data.byteLength; i += 4) {
                total_brightness += (image_data.data[i] + image_data.data[i+1] + image_data.data[i+2]) / 765
            }
            total_brightness /= image_data.data.byteLength / 4
            state.screen_brightness = total_brightness
            sg.uniforms.screen_brightness = total_brightness

            // calculate total acceleration
            const accel = state.acceleration
            const total_accel = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z)
      
            // modify speed
            let da = (total_accel > config.SPEED_THRESHOLD) ? 0.03 : 0
            state.speed = Math.min(0.8, state.speed + da) * 0.98
            sg.uniforms.speed = state.speed
      
            // calculate jerk
            state.jerk = Math.min(Math.max((total_accel - config.JERK_TRIGGER), 0), 1)
            state.jerk = isNaN(state.jerk) ? 0 : state.jerk
            sg.uniforms.jerk = state.jerk
            
            if (state.jerk > 0) { state.time_since_jerk = -1 }
            sg.uniforms.time_since_jerk = state.time_since_jerk++

            // calculate volume
            let volume = Math.min(Math.max((state.volume - config.VOLUME_TRIGGER) / 600, 0), 0.7)
            volume = (isNaN(volume)) ? 0 : volume
            state.normalized_volume = Math.max(state.normalized_volume * 0.95, volume)
            sg.uniforms.volume = state.normalized_volume

            // pass brightness values
            sg.uniforms.bright_low = config.BRIGHT_LOW
            sg.uniforms.bright_high = config.BRIGHT_HIGH
        })
        .textures([ Video.element ])
        .render( shader )
        .run()
}