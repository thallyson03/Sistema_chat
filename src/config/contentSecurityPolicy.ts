/**
 * CSP alinhada ao client (Google Fonts, mídia, WebSocket).
 * style-src sem 'unsafe-inline'; atributos style do React via style-src-attr.
 */
export const appContentSecurityPolicy = {
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    styleSrcAttr: ["'unsafe-inline'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'blob:', 'https:'],
    connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
    frameSrc: ["'self'", 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
  },
};
