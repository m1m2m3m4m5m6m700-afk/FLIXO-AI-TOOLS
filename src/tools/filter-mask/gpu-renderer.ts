const FILTER_FUNCTION = /([a-z-]+)\(([-+]?\d*\.?\d+)(deg|rad|%)?\)/giu;

type FilterParameters = {
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotateDeg: number;
  sepia: number;
};

type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const identityParameters = (): FilterParameters => ({
  brightness: 1,
  contrast: 1,
  saturate: 1,
  hueRotateDeg: 0,
  sepia: 0,
});

function parseFilter(cssFilter: string): FilterParameters | null {
  if (cssFilter === 'none' || !cssFilter.trim()) return identityParameters();
  const parameters = identityParameters();
  let match: RegExpExecArray | null;
  let matched = false;

  FILTER_FUNCTION.lastIndex = 0;
  let cursor = 0;
  while ((match = FILTER_FUNCTION.exec(cssFilter)) !== null) {
    if (cssFilter.slice(cursor, match.index).trim()) return null;
    const [, name, rawValue, unit] = match;
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) return null;
    const percentage = unit === '%' ? parsedValue / 100 : parsedValue;
    const value = unit === 'rad' ? (parsedValue * 180) / Math.PI : percentage;
    matched = true;
    switch (name.toLocaleLowerCase()) {
      case 'brightness':
        parameters.brightness = value;
        break;
      case 'contrast':
        parameters.contrast = value;
        break;
      case 'saturate':
        parameters.saturate = value;
        break;
      case 'hue-rotate':
        parameters.hueRotateDeg = unit === 'rad' ? (parsedValue * 180) / Math.PI : parsedValue;
        break;
      case 'sepia':
        parameters.sepia = Math.min(1, Math.max(0, value));
        break;
      default:
        return null;
    }
    cursor = FILTER_FUNCTION.lastIndex;
  }

  if (cssFilter.slice(cursor).trim()) return null;
  return matched ? parameters : null;
}

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
};

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
uniform vec4 uCrop;

void main() {
  vec2 clip = aPosition;
  vec2 uv = vec2(
    uCrop.x + ((aPosition.x + 1.0) * 0.5) * uCrop.z,
    uCrop.y + ((1.0 - aPosition.y) * 0.5) * uCrop.w
  );
  vUv = uv;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturate;
uniform float uHueRotate;
uniform float uSepia;
uniform float uIntensity;
uniform bool uMirror;
in vec2 vUv;
out vec4 outColor;

mat3 hueRotation(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  float w = 1.0 / 3.0;
  return mat3(
    c + (1.0 - c) * w, (1.0 - c) * w - sqrt(w) * s, (1.0 - c) * w + sqrt(w) * s,
    (1.0 - c) * w + sqrt(w) * s, c + (1.0 - c) * w, (1.0 - c) * w - sqrt(w) * s,
    (1.0 - c) * w - sqrt(w) * s, (1.0 - c) * w + sqrt(w) * s, c + (1.0 - c) * w
  );
}

vec3 applySepia(vec3 color, float amount) {
  vec3 sepiaColor = vec3(
    dot(color, vec3(0.393, 0.769, 0.189)),
    dot(color, vec3(0.349, 0.686, 0.168)),
    dot(color, vec3(0.272, 0.534, 0.131))
  );
  return mix(color, sepiaColor, amount);
}

vec3 applyFilter(vec3 color) {
  color *= uBrightness;
  color = (color - 0.5) * uContrast + 0.5;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luminance), color, uSaturate);
  color = hueRotation(radians(uHueRotate)) * color;
  color = applySepia(color, uSepia);
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  if (uMirror) uv.x = 1.0 - uv.x;
  vec4 source = texture(uTexture, uv);
  vec3 filtered = applyFilter(source.rgb);
  vec3 outputRgb = mix(source.rgb, filtered, clamp(uIntensity, 0.0, 1.0));
  outColor = vec4(outputRgb, source.a);
}`;

export type GpuFilterRenderer = {
  readonly kind: 'webgl2';
  readonly canvas: HTMLCanvasElement;
  render(
    video: HTMLVideoElement,
    cssFilter: string,
    intensity: number,
    crop: Crop,
    mirror: boolean,
  ): boolean;
  dispose(): void;
};

export type FilterRenderBackend = GpuFilterRenderer | {
  readonly kind: 'canvas2d';
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
};

export function createWebGL2FilterRenderer(canvas: HTMLCanvasElement): GpuFilterRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });

  if (!gl) return null;

  let vertex: WebGLShader;
  let fragment: WebGLShader;
  let program: WebGLProgram;
  let texture: WebGLTexture;
  let buffer: WebGLBuffer;

  try {
    vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'WebGL program link failed.');
    }

    texture = gl.createTexture()!;
    buffer = gl.createBuffer()!;
    if (!texture || !buffer) throw new Error('WebGL resource allocation failed.');

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const textureUnit = gl.getUniformLocation(program, 'uTexture');
    gl.uniform1i(textureUnit, 0);

    const uCrop = gl.getUniformLocation(program, 'uCrop');
    const uBrightness = gl.getUniformLocation(program, 'uBrightness');
    const uContrast = gl.getUniformLocation(program, 'uContrast');
    const uSaturate = gl.getUniformLocation(program, 'uSaturate');
    const uHueRotate = gl.getUniformLocation(program, 'uHueRotate');
    const uSepia = gl.getUniformLocation(program, 'uSepia');
    const uIntensity = gl.getUniformLocation(program, 'uIntensity');
    const uMirror = gl.getUniformLocation(program, 'uMirror');

    const upload = (video: HTMLVideoElement) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    };

    const render = (
      video: HTMLVideoElement,
      cssFilter: string,
      intensity: number,
      crop: Crop,
      mirror: boolean,
    ) => {
      if (!video.videoWidth || !video.videoHeight) return false;
      const parsed = parseFilter(cssFilter);
      if (!parsed) return false;

      canvas.width = canvas.width || 1;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform4f(uCrop, crop.x / video.videoWidth, crop.y / video.videoHeight, crop.width / video.videoWidth, crop.height / video.videoHeight);
      gl.uniform1f(uBrightness, parsed.brightness);
      gl.uniform1f(uContrast, parsed.contrast);
      gl.uniform1f(uSaturate, parsed.saturate);
      gl.uniform1f(uHueRotate, parsed.hueRotateDeg);
      gl.uniform1f(uSepia, parsed.sepia);
      gl.uniform1f(uIntensity, Math.min(1, Math.max(0, intensity / 100)));
      gl.uniform1i(uMirror, mirror ? 1 : 0);
      upload(video);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    };

    return {
      kind: 'webgl2',
      canvas,
      render,
      dispose: () => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      },
    };
  } catch {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}

export function filterSupportsGpu(cssFilter: string): boolean {
  return parseFilter(cssFilter) !== null;
}

export function filterParametersForTest(cssFilter: string): FilterParameters | null {
  return parseFilter(cssFilter);
}
