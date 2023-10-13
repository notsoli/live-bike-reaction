@group(0) @binding(0) var<uniform> frame: f32;
@group(0) @binding(1) var<uniform> resolution: vec2f;
@group(0) @binding(2) var<uniform> screen_brightness: f32;
@group(0) @binding(3) var<uniform> speed: f32;
@group(0) @binding(4) var<uniform> jerk: f32;
@group(0) @binding(5) var<uniform> time_since_jerk: f32;
@group(0) @binding(6) var<uniform> volume: f32;
@group(0) @binding(7) var<uniform> bright_low: f32;
@group(0) @binding(8) var<uniform> bright_high: f32;
@group(0) @binding(9) var videoSampler: sampler;
@group(0) @binding(10) var backBuffer: texture_2d<f32>;
@group(0) @binding(11) var backSampler: sampler;
@group(1) @binding(0) var videoBuffer: texture_external;

// grab a determinstic random point based on grid position
fn get_point(grid_pos : vec2f) -> f32 {
    let random = fract(sin(dot(grid_pos.xy * sin(frame / 10.),vec2(12.9898,78.233)))*43758.5453123);
    let val = (random - 0.5) * frame/10. + random * 6.283;
    return saturate(val);
}

fn pain(pos: vec4f) -> vec4f {
    var pain_out = vec3(0.922,0.518,0.286);

    let idx = floor(pos.y / 4.) * floor(resolution.y / 4.) + floor(pos.x / 4.) + frame * 4.;
    if (idx % (127. + sin(frame / 576.) * 3.) < 30. + sin(frame / 97.) * 10.) { pain_out += vec3(0.1, 0.1, 0.1); }

    return vec4(pain_out, 1.);
}

@fragment 
fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
    var position = pos.xy / resolution;
    // position.x *= resolution.x / resolution.y;

    // calculate brightness effect
    let pain_value = pain(pos);
    let pain_multiplier = saturate((screen_brightness - bright_low) / (bright_high - bright_low)) * 0.6;
    var wavy_position = position;
    wavy_position.x += sin((position.x + position.y) * 25. + frame / 7.5) * pain_multiplier * 0.03;
    
    // sample video, making it wavy if bright
    var video = textureSampleBaseClampToEdge( videoBuffer, videoSampler, wavy_position);
    video = (video - 0.5) * (1. + pain_multiplier * 5.) + 0.5;

    // mix brightness effect with video
    var out = mix(video, pain_value, pain_multiplier);

    // flash red on edges of screen upon loud noises;
    var volume_multiplier = saturate(abs((pos.x / resolution.x - 0.5) * 2.) * 4. - 3.) * volume;
    out = mix(out, vec4(0.412, 0.569, 0.82, 1.), volume_multiplier);

    // sample previous frame, mixing it with current frame to create a warp speed effect
    let prev_frame = textureSample( backBuffer, backSampler, pos.xy / resolution);
    var feedback_factor = 1. - pow(1. - speed, 2.0);

    // find pixel information of sorting pair
    let polarity = floor(frame + pos.x) % 2. * 2. - 1.;
    let pair_position = vec2(pos.x + polarity, pos.y + polarity) / resolution;
    var pair_pixel = textureSample( backBuffer, backSampler, pair_position );
    if (pair_position.x > 1. || pair_position.y > 1.) {
        pair_pixel = vec4(0., 0., 0., 1.);
    }
    if (pair_position.x < 0. || pair_position.y < 0.) {
        pair_pixel = vec4(1., 1., 1., 1.);
    }

    // sort pixels upon jerk
    if (time_since_jerk < 50.) {
        feedback_factor = 0.;

        // compare and swap pixel based on brightness
        let this_brightness = (prev_frame.r + prev_frame.g + prev_frame.b) / 3.;
        let pair_brightness = (pair_pixel.r + pair_pixel.g + pair_pixel.b) / 3.;

        out = prev_frame;
        if (polarity > 0.) {
            if (this_brightness <= pair_brightness) { out = pair_pixel; }
        } else {
            if (this_brightness > pair_brightness) { out = pair_pixel; }
        }
    }

    if (time_since_jerk >= 50. && time_since_jerk < 70.) { feedback_factor = 1. - (time_since_jerk - 50.) / 20.; }

    // apply feedback to frame
    out = out * (1. - feedback_factor) + prev_frame * feedback_factor;

    return out;
}