/**
 * `@mieweb/datavis/chat` — the chat display mode. Kept out of the root entry
 * because it renders through `@mieweb/ui`'s SuperChat, which needs the
 * `react-markdown`, `remark-gfm` and `rehype-sanitize` peers.
 */
export * from './components/chat';
