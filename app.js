import { default as seagulls } from './seagulls.js'
import { default as Video } from './video.js'
import { default as Serial } from './serial.js'

let video_canvas, video_ctx

document.addEventListener('keydown', async (e) => {
    if (e.key == " ") {
        const text = document.querySelector("h1")
        text.innerHTML = "loading..."
        await Video.init()
        await Serial.init()
        await sg_init()
        text.style.display = "none"
    }
})

async function sg_init() {
    const state = Serial.state

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
        speed: state.speed, jerk: state.jerk, time_since_jerk: state.time_since_jerk, volume: state.normalized_volume })
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
            let da = (total_accel > 10.5) ? 0.03 : 0
            state.speed = Math.min(0.8, state.speed + da) * 0.98
            sg.uniforms.speed = state.speed
      
            // calculate jerk
            state.jerk = Math.min(Math.max((total_accel - 25), 0), 1)
            state.jerk = isNaN(state.jerk) ? 0 : state.jerk
            sg.uniforms.jerk = state.jerk
            
            if (state.jerk > 0) { state.time_since_jerk = -1 }
            sg.uniforms.time_since_jerk = state.time_since_jerk++

            // calculate volume
            let volume = Math.min(Math.max((state.volume - 150) / 600, 0), 0.7)
            volume = (isNaN(volume)) ? 0 : volume
            state.normalized_volume = Math.max(state.normalized_volume * 0.95, volume)
            sg.uniforms.volume = state.normalized_volume
        })
        .textures([ Video.element ])
        .render( shader )
        .run()
}