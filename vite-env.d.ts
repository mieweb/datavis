/// <reference types="vite/client" />

declare module '*.tsv?raw' {
  const content: string;
  export default content;
}
