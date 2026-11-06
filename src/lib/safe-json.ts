// JSON for an inline <script> tag: "<" is escaped, so text from a listing can never close the tag
// and run as code in a visitor's browser.
export const safeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
