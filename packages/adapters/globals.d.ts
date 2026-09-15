// `TextDecoder` is a WHATWG global: every browser has it, so has Node since 11.
// Declared here rather than by adding `lib.dom` or `@types/node` to an
// isomorphic package — a package that can see `document` eventually touches it,
// and this is the only platform global anything under packages/ needs.
declare const TextDecoder: {
  new (label?: string): {
    decode(input?: ArrayBufferView | ArrayBuffer): string;
  };
};
