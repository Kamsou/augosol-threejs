import * as THREE from 'three'

// Last pass, runs in display (sRGB) space after OutputPass
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFilter: { value: 0 },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uDof: { value: 0 },
    uMood: { value: 0 },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSpeed;
    uniform vec2 uResolution;
    uniform int uFilter;
    uniform vec2 uFocus;
    uniform float uDof;
    uniform float uMood;

    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float luma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float dist = length(c);

      // Lens chromatic aberration, stronger at full gallop
      float ca = (0.0012 + uSpeed * 0.0055) * dist;
      vec3 col = vec3(
        texture2D(tDiffuse, uv + c * ca).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - c * ca).b
      );

      // Radial speed blur towards the screen edges
      if (uSpeed > 0.02) {
        float amt = uSpeed * smoothstep(0.22, 0.75, dist) * 0.05;
        vec3 acc = col;
        for (int i = 1; i <= 6; i++) {
          acc += texture2D(tDiffuse, uv - c * amt * (float(i) / 6.0)).rgb;
        }
        col = acc / 7.0;
      }

      // Photo mode: focus on the subject, soft bokeh around it
      if (uDof > 0.01) {
        float aspect = uResolution.x / uResolution.y;
        vec2 d = (uv - uFocus) * vec2(aspect, 1.0);
        float blur = smoothstep(0.1, 0.55, length(d)) * uDof * 0.014;
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 16.0);
          acc += texture2D(tDiffuse, uv + vec2(cos(a) / aspect, sin(a)) * r * blur).rgb;
        }
        col = mix(col, acc / 16.0, smoothstep(0.0, 0.002, blur));
      }

      // Grade: cool shadows, warm highlights, soft filmic contrast
      float l = luma(col);
      col = mix(col, col * vec3(0.92, 0.98, 1.07), (1.0 - smoothstep(0.0, 0.45, l)) * 0.5);
      col = mix(col, col * vec3(1.05, 1.0, 0.92), smoothstep(0.55, 1.0, l) * 0.4);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

      if (uFilter == 1) {
        // Heure dorée
        col = col * vec3(1.1, 0.98, 0.8) + vec3(0.035, 0.012, 0.0);
        col = mix(vec3(luma(col)), col, 1.18);
      } else if (uFilter == 2) {
        // Argentique noir & blanc
        float g = luma(col);
        col = vec3(smoothstep(0.04, 0.96, g));
      } else if (uFilter == 3) {
        // Rêve pastel
        col = mix(vec3(luma(col)), col, 0.8);
        col = col * 0.82 + vec3(0.18, 0.15, 0.17);
      }

      // How the place feels to the horse: drained and cold, or warm and vivid
      float tense = max(-uMood, 0.0);
      float warm = max(uMood, 0.0);
      col = mix(col, vec3(luma(col)), 0.45 * tense);
      col *= mix(vec3(1.0), vec3(0.88, 0.95, 1.07), tense) * (1.0 - 0.1 * tense);
      col = mix(vec3(luma(col)), col, 1.0 + 0.08 * warm);
      col *= mix(vec3(1.0), vec3(1.04, 1.0, 0.95), warm);

      col *= mix(1.0, smoothstep(0.88, 0.25, dist), 0.5 + uSpeed * 0.25 + tense * 0.35);
      col += (rand(uv * uResolution + fract(uTime) * 91.7) - 0.5) * (uFilter == 2 ? 0.07 : 0.03);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
}
