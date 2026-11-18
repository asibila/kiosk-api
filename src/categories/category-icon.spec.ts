import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_CATEGORY_ICON_SVG_LENGTH,
  sanitizeCategoryIconSvg,
} from './category-icon.js';

/** A typical icon copied from an icon set (Lucide's bike). */
const LUCIDE_BIKE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bike">
  <circle cx="18.5" cy="17.5" r="3.5" />
  <circle cx="5.5" cy="17.5" r="3.5" />
  <circle cx="15" cy="5" r="1" />
  <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
</svg>`;

describe('sanitizeCategoryIconSvg', () => {
  it('normalizes a pasted icon and keeps its geometry and paint attributes', () => {
    const svg = sanitizeCategoryIconSvg(LUCIDE_BIKE);

    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('<circle cx="18.5" cy="17.5" r="3.5" />');
    expect(svg).toContain('<path d="M12 17.5V14l-3-3 4-3 2 3h2" />');
    // The wrapper owns size and styling: exports carry these, the API drops them.
    expect(svg).not.toContain('width="24"');
    expect(svg).not.toContain('class=');
    expect(svg).not.toMatch(/<svg[^>]*xmlns="[^"]*"[^>]*xmlns=/);
  });

  it('normalizes a single-line icon without whitespace', () => {
    expect(
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>',
      ),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /></svg>',
    );
  });

  it('drops inert attributes such as class, id, style and event handlers', () => {
    const svg = sanitizeCategoryIconSvg(
      '<svg viewBox="0 0 24 24" class="x" id="y" style="fill:red" onload="alert(1)">' +
        '<path d="M4 4h16" onclick="alert(1)" fill="#ff0000" />' +
        '</svg>',
    );

    expect(svg).not.toMatch(/onload|onclick|class=|id=|style=/);
    expect(svg).toContain('fill="#ff0000"');
  });

  it('keeps groups, polygons and multi-shape icons', () => {
    const svg = sanitizeCategoryIconSvg(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
        '<g transform="translate(2 2)"><polygon points="12 2 21 7 12 12" /></g>' +
        '<rect x="1" y="1" width="4" height="4" rx="1" />' +
        '</svg>',
    );

    expect(svg).toContain('<g transform="translate(2 2)">');
    expect(svg).toContain('<polygon points="12 2 21 7 12 12" />');
    expect(svg).toContain('<rect x="1" y="1" width="4" height="4" rx="1" />');
  });

  it.each([
    ['<script />', 'script'],
    ['<foreignObject />', 'foreignObject'],
    ['<use href="#x" />', 'use'],
    ['<image href="https://example.com/x.png" />', 'image'],
    ['<a />', 'a'],
    ['<style />', 'style'],
  ])('rejects the %s element', (inner, name) => {
    expect(() =>
      sanitizeCategoryIconSvg(`<svg viewBox="0 0 24 24">${inner}</svg>`),
    ).toThrow(new RegExp(`<${name}>`, 'i'));
  });

  it('rejects an executable element even when it carries text', () => {
    expect(() =>
      sanitizeCategoryIconSvg('<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>'),
    ).toThrow(BadRequestException);
  });

  it('rejects text content', () => {
    expect(() =>
      sanitizeCategoryIconSvg('<svg viewBox="0 0 24 24">hello</svg>'),
    ).toThrow(/text content/);
  });

  it('rejects a missing viewBox', () => {
    expect(() =>
      sanitizeCategoryIconSvg('<svg><path d="M0 0" /></svg>'),
    ).toThrow(/viewBox/);
  });

  it('rejects unclosed or mismatched tags', () => {
    expect(() =>
      sanitizeCategoryIconSvg('<svg viewBox="0 0 24 24"><g><path d="M0 0" /></svg>'),
    ).toThrow(/unexpected closing tag/);

    expect(() =>
      sanitizeCategoryIconSvg('<svg viewBox="0 0 24 24"><path d="M0 0" /></g></svg>'),
    ).toThrow(/unexpected closing tag/);

    expect(() =>
      sanitizeCategoryIconSvg('<svg viewBox="0 0 24 24"><g></g>'),
    ).toThrow(/unclosed <svg>/);
  });

  it('rejects nested svg elements and markup after the root', () => {
    expect(() =>
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24"><svg viewBox="0 0 1 1" /></svg>',
      ),
    ).toThrow(/nested/);

    expect(() =>
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24" /><svg viewBox="0 0 24 24" />',
      ),
    ).toThrow();
  });

  it('rejects dangerous attribute values', () => {
    expect(() =>
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24"><path d="M0 0" fill="javascript:alert(1)" /></svg>',
      ),
    ).toThrow(/unsupported value/);

    expect(() =>
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24"><path d="M0 0" fill="url(#x)" /></svg>',
      ),
    ).toThrow(/unsupported value/);

    expect(() =>
      sanitizeCategoryIconSvg(
        '<svg viewBox="0 0 24 24"><path d="M0 0 <script>" /></svg>',
      ),
    ).toThrow(/disallowed character|well-formed/);
  });

  it('rejects an empty icon', () => {
    expect(() => sanitizeCategoryIconSvg('')).toThrow(/empty/);
    expect(() => sanitizeCategoryIconSvg('   ')).toThrow(/empty/);
  });

  it('enforces the stored length budget', () => {
    const longPaths = Array.from(
      { length: 150 },
      () => '<path d="M0 0h10v10H0z" stroke-width="1.5" />',
    ).join('');

    expect(() =>
      sanitizeCategoryIconSvg(`<svg viewBox="0 0 24 24">${longPaths}</svg>`),
    ).toThrow(new RegExp(String(MAX_CATEGORY_ICON_SVG_LENGTH)));
  });

  it('throws a 400 exception the admin can act on', () => {
    expect(() => sanitizeCategoryIconSvg('<div />')).toThrow(BadRequestException);
  });

  it('keeps every default backfill icon valid and within budget', () => {
    const icons = JSON.parse(
      readFileSync(
        new URL('../../prisma/category-icons.json', import.meta.url),
        'utf8',
      ),
    ) as Record<string, string>;

    expect(Object.keys(icons).length).toBeGreaterThan(0);
    for (const [name, markup] of Object.entries(icons)) {
      const svg = sanitizeCategoryIconSvg(markup);
      expect(svg, name).toContain('viewBox="0 0 24 24"');
      expect(svg.length, name).toBeLessThanOrEqual(MAX_CATEGORY_ICON_SVG_LENGTH);
    }
  });
});
