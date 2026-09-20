const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

export type SeedRenderSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  ambiance: number;
  highlights: number;
  shadows: number;
};

const DEFAULT_RENDER_SETTINGS: SeedRenderSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  ambiance: 0,
  highlights: 0,
  shadows: 0,
};

export class SeedGLEngine {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private texture: WebGLTexture | null = null;
  private sourceWidth = 1;
  private sourceHeight = 1;
  private readonly maxTextureSize: number;

  constructor(private readonly canvas: HTMLCanvasElement, fragmentSource: string) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not supported by this browser.');
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.program = this.createProgram(VERTEX_SHADER, fragmentSource);
    this.setupBuffers();
    this.uniforms = {
      image: gl.getUniformLocation(this.program, 'u_image'),
      brightness: gl.getUniformLocation(this.program, 'u_brightness'),
      contrast: gl.getUniformLocation(this.program, 'u_contrast'),
      saturation: gl.getUniformLocation(this.program, 'u_saturation'),
      warmth: gl.getUniformLocation(this.program, 'u_warmth'),
      ambiance: gl.getUniformLocation(this.program, 'u_ambiance'),
      highlights: gl.getUniformLocation(this.program, 'u_highlights'),
      shadows: gl.getUniformLocation(this.program, 'u_shadows'),
    };
  }

  setImage(image: HTMLImageElement) {
    const gl = this.gl;
    if (image.naturalWidth > this.maxTextureSize || image.naturalHeight > this.maxTextureSize) {
      throw new Error(`Image exceeds this GPU's texture limit (${this.maxTextureSize}px).`);
    }
    if (!this.texture) this.texture = gl.createTexture();
    if (!this.texture) throw new Error('Unable to create WebGL texture.');
    this.sourceWidth = image.naturalWidth;
    this.sourceHeight = image.naturalHeight;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`Unable to upload image to GPU (WebGL error ${error}).`);

    // Prime the framebuffer immediately after texture upload. This removes a browser-timing
    // dependency for consumers that inspect WebGL pixels immediately after loading an image.
    this.render(DEFAULT_RENDER_SETTINGS);
  }

  render(settings: SeedRenderSettings) {
    if (!this.texture) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.image, 0);
    gl.uniform1f(this.uniforms.brightness, settings.brightness / 100);
    gl.uniform1f(this.uniforms.contrast, settings.contrast / 100);
    gl.uniform1f(this.uniforms.saturation, settings.saturation / 100);
    gl.uniform1f(this.uniforms.warmth, settings.warmth / 100);
    gl.uniform1f(this.uniforms.ambiance, settings.ambiance / 100);
    gl.uniform1f(this.uniforms.highlights, settings.highlights / 100);
    gl.uniform1f(this.uniforms.shadows, settings.shadows / 100);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`GPU render failed (WebGL error ${error}).`);
  }

  async exportPng(): Promise<Blob> {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const rgba = new Uint8Array(width * height * 4);
    gl.finish();
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`GPU export failed (WebGL error ${error}).`);

    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d');
    if (!ctx) throw new Error('Unable to create export canvas.');
    const imageData = ctx.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y += 1) {
      const src = (height - 1 - y) * rowBytes;
      const dst = y * rowBytes;
      imageData.data.set(rgba.subarray(src, src + rowBytes), dst);
    }
    ctx.putImageData(imageData, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      output.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode PNG export.'))), 'image/png');
    });
  }

  getSourceSize() {
    return { width: this.sourceWidth, height: this.sourceHeight };
  }

  getMaxTextureSize() {
    return this.maxTextureSize;
  }

  destroy() {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
  }

  private setupBuffers() {
    const gl = this.gl;
    gl.useProgram(this.program);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    this.bindAttribute('a_position', positions);
    this.bindAttribute('a_texCoord', texCoords);
  }

  private bindAttribute(name: string, data: Float32Array) {
    const gl = this.gl;
    const location = gl.getAttribLocation(this.program, name);
    if (location < 0) throw new Error(`Missing shader attribute: ${name}`);
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error(`Unable to create shader buffer: ${name}`);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  private createProgram(vertexSource: string, fragmentSource: string) {
    const gl = this.gl;
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? 'Unknown WebGL link error.';
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  private compileShader(type: number, source: string) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create WebGL shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? 'Unknown WebGL compile error.';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }
}