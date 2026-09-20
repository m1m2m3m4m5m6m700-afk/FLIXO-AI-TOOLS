precision highp float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_warmth;
uniform float u_ambiance;
uniform float u_highlights;
uniform float u_shadows;

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  vec3 rgb = color.rgb;

  rgb += u_brightness;
  rgb = (rgb - 0.5) * (1.0 + u_contrast) + 0.5;

  float gray = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(gray), rgb, 1.0 + u_saturation);

  float shadowMask = 1.0 - smoothstep(0.0, 0.55, gray);
  float highlightMask = smoothstep(0.45, 1.0, gray);
  rgb += u_shadows * shadowMask;
  rgb += u_highlights * highlightMask;

  float midtone = 1.0 - abs(gray * 2.0 - 1.0);
  rgb += u_ambiance * midtone * 0.2;

  rgb.r += u_warmth * 0.15;
  rgb.b -= u_warmth * 0.15;

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
