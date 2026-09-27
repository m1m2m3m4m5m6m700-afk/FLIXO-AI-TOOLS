interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.glsl?raw" {
  const source: string;
  export default source;
}
