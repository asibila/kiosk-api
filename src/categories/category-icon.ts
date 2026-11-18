import { BadRequestException } from '@nestjs/common';

/**
 * Longest inline SVG the API stores, measured after normalization. Category
 * icons travel in `GET /categories`, which the clients load on every page, so
 * the budget is deliberately small (a typical icon is a few hundred bytes).
 */
export const MAX_CATEGORY_ICON_SVG_LENGTH = 4096;

/**
 * Elements an icon may use. Icons are drawn with shapes and groups only:
 * `script`, `style`, `foreignObject`, `use`, `image` and `a` can execute or
 * load external content, so they are rejected outright rather than stripped.
 */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
]);

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|px|em|rem)?$/i;
const COLOR =
  /^(?:none|inherit|transparent|[a-zA-Z]+|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\))$/;
const PAINT_ORDER = /^(?:nonzero|evenodd|inherit)$/;

/**
 * Attribute values are validated per attribute, so a stray `url(...)`,
 * `javascript:` or entity cannot smuggle a second meaning into the markup.
 * Unknown attributes are dropped: pasted icons carry `class`, `xmlns` and
 * `width`/`height`, which the renderer replaces with its own wrapper.
 */
const ATTRIBUTE_RULES: Record<string, RegExp> = {
  d: /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/,
  points: /^[0-9eE.,+\-\s]*$/,
  viewBox: /^-?[\d.]+(?:[,\s]+-?[\d.]+){3}$/,
  preserveAspectRatio: /^[a-zA-Z0-9\s]+$/,
  transform:
    /^(?:(?:translate|scale|rotate|skewX|skewY|matrix)\([0-9eE.,+\-\s]*\)\s*)+$/,
  x: NUMBER,
  y: NUMBER,
  x1: NUMBER,
  y1: NUMBER,
  x2: NUMBER,
  y2: NUMBER,
  cx: NUMBER,
  cy: NUMBER,
  r: NUMBER,
  rx: NUMBER,
  ry: NUMBER,
  width: NUMBER,
  height: NUMBER,
  fill: COLOR,
  stroke: COLOR,
  'fill-opacity': NUMBER,
  'stroke-opacity': NUMBER,
  opacity: NUMBER,
  'stroke-width': NUMBER,
  'stroke-dasharray': /^[0-9eE.,+\-\s]*$/,
  'stroke-dashoffset': NUMBER,
  'stroke-linecap': /^(?:butt|round|square|inherit)$/,
  'stroke-linejoin': /^(?:miter|round|bevel|arcs|miter-clip|inherit)$/,
  'stroke-miterlimit': NUMBER,
  'fill-rule': PAINT_ORDER,
  'clip-rule': PAINT_ORDER,
  'vector-effect': /^(?:none|non-scaling-stroke)$/,
};

/** Root attributes that are dropped: the wrapper controls the box and size. */
const ROOT_DROPPED_ATTRIBUTES = new Set(['width', 'height', 'x', 'y']);

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type Token =
  | { closing: true; name: string }
  | { closing: false; name: string; attrs: Array<[string, string]>; selfClosing: boolean };

const TAG_PATTERN =
  /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z][a-zA-Z0-9:_-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;

const ATTRIBUTE_PATTERN =
  /([a-zA-Z][a-zA-Z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function invalid(reason: string): never {
  throw new BadRequestException(`Invalid category icon: ${reason}`);
}

function parseAttributes(source: string): Array<[string, string]> {
  const attrs: Array<[string, string]> = [];
  let index = 0;

  ATTRIBUTE_PATTERN.lastIndex = 0;
  for (let match = ATTRIBUTE_PATTERN.exec(source); match; match = ATTRIBUTE_PATTERN.exec(source)) {
    // Anything between attributes has to be whitespace; a stray character means
    // the markup is not the simple, well-formed subset this parser accepts.
    if (source.slice(index, match.index).trim() !== '') {
      invalid('unexpected text inside a tag');
    }
    attrs.push([match[1], match[2] ?? match[3] ?? '']);
    index = match.index + match[0].length;
  }

  if (source.slice(index).trim() !== '') invalid('unexpected text inside a tag');
  return attrs;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const whitespace = /^\s+/.exec(source.slice(index));
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }

    if (source[index] !== '<') {
      invalid('text content is not supported, only SVG shapes');
    }

    TAG_PATTERN.lastIndex = index;
    const match = TAG_PATTERN.exec(source);
    if (!match) invalid('the markup is not well-formed');

    const [raw, closingSlash, rawName, rawAttrs, selfClosingSlash] = match;
    const name = rawName.toLowerCase();
    const closing = closingSlash === '/';
    const selfClosing = selfClosingSlash === '/';

    if (closing && selfClosing) invalid('a closing tag cannot be self-closing');
    if (closing) {
      if (rawAttrs.trim() !== '') invalid('a closing tag cannot have attributes');
      tokens.push({ closing: true, name });
    } else {
      tokens.push({
        closing: false,
        name,
        attrs: parseAttributes(rawAttrs),
        selfClosing,
      });
    }

    index += raw.length;
  }

  return tokens;
}

function normalizeAttributes(
  element: string,
  attrs: Array<[string, string]>,
  isRoot: boolean,
): string[] {
  const kept: string[] = [];

  for (const [rawName, value] of attrs) {
    const name = rawName;

    // `xmlns` is re-emitted by this function; the rest are inert markup that
    // icon exports carry (class, id, style, aria-*, …) and are dropped.
    if (name === 'xmlns') continue;
    if (isRoot && ROOT_DROPPED_ATTRIBUTES.has(name)) continue;
    if (element !== 'svg' && name === 'viewBox') continue;

    const rule = ATTRIBUTE_RULES[name];
    if (!rule) continue;

    if (/[<>&]/.test(value)) invalid(`attribute "${name}" contains a disallowed character`);
    if (!rule.test(value.trim())) invalid(`attribute "${name}" has an unsupported value`);

    kept.push(`${name}="${value.trim()}"`);
  }

  return kept;
}

/**
 * Validate and re-serialize an inline SVG icon. The output contains only the
 * allow-listed elements and attributes, re-quoted by this function, so it is
 * safe to store and render with `innerHTML` on the clients.
 *
 * Throws `BadRequestException` with a message the admin can act on.
 */
export function sanitizeCategoryIconSvg(input: string): string {
  const source = input.trim();
  if (source === '') invalid('the SVG is empty');
  if (source.length > MAX_CATEGORY_ICON_SVG_LENGTH * 4) {
    invalid('the SVG is too long');
  }

  const tokens = tokenize(source);
  if (tokens.length === 0) invalid('the SVG is empty');

  const stack: string[] = [];
  let root: { viewBox: string; extra: string[] } | null = null;
  const body: string[] = [];

  for (const token of tokens) {
    if (token.closing) {
      if (stack.length === 0 || stack[stack.length - 1] !== token.name) {
        invalid(`unexpected closing tag </${token.name}>`);
      }
      stack.pop();
      body.push(`</${token.name}>`);
      continue;
    }

    if (!ALLOWED_ELEMENTS.has(token.name)) {
      invalid(
        `element <${token.name}> is not allowed (use ${[...ALLOWED_ELEMENTS].join(', ')})`,
      );
    }

    const isRoot = root === null;
    if (isRoot && token.name !== 'svg') invalid('the SVG must start with <svg>');
    if (!isRoot && token.name === 'svg') invalid('nested <svg> elements are not supported');
    if (isRoot && stack.length > 0) invalid('the markup is not well-formed');
    if (!isRoot && stack.length === 0) invalid('the icon must have a single <svg> root');

    const attributes = normalizeAttributes(token.name, token.attrs, isRoot);
    const viewBox = token.attrs.find(([name]) => name === 'viewBox')?.[1]?.trim();

    if (isRoot) {
      if (!viewBox || !ATTRIBUTE_RULES.viewBox.test(viewBox)) {
        invalid('the <svg> needs a viewBox such as "0 0 24 24"');
      }
      // The wrapper below emits the namespace and the viewBox itself.
      root = {
        viewBox,
        extra: attributes.filter((attribute) => !attribute.startsWith('viewBox=')),
      };
      // Placeholder: removed before the root tag is rebuilt after the walk.
      body.push('');
    } else {
      body.push(
        `<${token.name}${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}${
          token.selfClosing ? ' />' : '>'
        }`,
      );
    }

    if (!token.selfClosing) stack.push(token.name);
  }

  if (root === null) invalid('the SVG is missing');
  if (stack.length > 0) invalid(`unclosed <${stack[stack.length - 1]}> element`);

  // `body` starts with the opening root tag, which the wrapper rebuilds with the
  // namespace and a normalized viewBox; drop that placeholder.
  body.shift();
  const closingRoot = body.pop();
  if (closingRoot !== '</svg>') invalid('the icon must have a single <svg> root');

  const svg =
    `<svg xmlns="${SVG_NAMESPACE}" viewBox="${root.viewBox}"` +
    `${root.extra.length > 0 ? ` ${root.extra.join(' ')}` : ''}>` +
    body.join('') +
    '</svg>';

  if (svg.length > MAX_CATEGORY_ICON_SVG_LENGTH) {
    invalid(
      `the stored icon would be ${svg.length} characters, the limit is ${MAX_CATEGORY_ICON_SVG_LENGTH}`,
    );
  }

  return svg;
}
