// `TextDecoder` and `TextEncoder` are WHATWG globals: every browser has them, so has
// Node since 11. Declared here rather than by adding `lib.dom` or `@types/node` to an
// isomorphic package — a package that can see `document` eventually touches it, and
// these are the only platform globals anything under packages/ needs. The encoder is
// `site-run`'s, which writes the document it later reads (E26.21).
declare const TextDecoder: {
  new (label?: string): {
    decode(input?: ArrayBufferView | ArrayBuffer): string;
  };
};

declare const TextEncoder: {
  new (): {
    encode(input?: string): Uint8Array;
  };
};
