# Typography

<!-- go/mwc-typography -->

<!--*
# Document freshness: For more information, see go/fresh-source.
freshness: { owner: 'lizmitchell' reviewed: '2023-09-06' }
tag: 'docType:howTo'
*-->

<!-- [TOC] -->

[Typography](https://m3.material.io/styles/typography)<!-- {.external} --> helps make
writing legible and beautiful.

## Typeface

<!-- go/md-ref-typeface -->

A [typeface](https://m3.material.io/styles/typography/fonts)<!-- {.external} --> is a
`font-family`. In Material there are plain and brand typefaces.

Each typeface has normal, medium, and bold styles (defaults to `400`, `500`, and
`700`). All three weight styles need to be included for a font.

> Important: use
> [fonts.google.com](https://fonts.google.com/share?selection.family=Roboto:wght@400;500;700)
> if using the default typeface, `'Roboto'`.

### Tokens

Typefaces can be set using
[CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)<!-- {.external} -->.
Tokens follow the naming convention `--md-ref-typeface-<token>`.

Typeface | Token
-------- | -------------------------
Brand    | `--md-ref-typeface-brand`
Plain    | `--md-ref-typeface-plain`

*   [All tokens](https://github.com/material-components/material-web/blob/main/tokens/_md-ref-typeface.scss)
    <!-- {.external} -->

```css
@import url('https://fonts.googleapis.com/css2?family=Open%20Sans:wght@400;500;700&display=swap');

:root {
  --md-ref-typeface-brand: 'Open Sans';
  --md-ref-typeface-plain: system-ui;
}
```

## Typescale

<!-- go/md-sys-typescale -->

A
[typescale](https://m3.material.io/styles/typography/type-scale-tokens)<!-- {.external} -->
is a collection of font styles: `font-family`, `font-size`, `line-height`, and
`font-weight`.

### Tokens

Typescales can be set using
[CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)<!-- {.external} -->.
Each typescale has three sizes: `small`, `medium`, and `large`. Each size has
four properties: `font` (family), `size`, `line-height`, and `weight`.

Tokens follow the naming convention
`--md-sys-typescale-<scale>-<size>-<property>`.

Typescale | Tokens
--------- | ------------------------------------------------
Display   | `--md-sys-typescale-display-medium-font`
&nbsp;    | `--md-sys-typescale-display-medium-size`
&nbsp;    | `--md-sys-typescale-display-medium-line-height`
&nbsp;    | `--md-sys-typescale-display-medium-weight`
Headline  | `--md-sys-typescale-headline-font`
&nbsp;    | `--md-sys-typescale-headline-medium-size`
&nbsp;    | `--md-sys-typescale-headline-medium-line-height`
&nbsp;    | `--md-sys-typescale-headline-medium-weight`
Title     | `--md-sys-typescale-title-medium-font`
&nbsp;    | `--md-sys-typescale-title-medium-size`
&nbsp;    | `--md-sys-typescale-title-medium-line-height`
&nbsp;    | `--md-sys-typescale-title-medium-weight`
Body      | `--md-sys-typescale-body-medium-font`
&nbsp;    | `--md-sys-typescale-body-medium-size`
&nbsp;    | `--md-sys-typescale-body-medium-line-height`
&nbsp;    | `--md-sys-typescale-body-medium-weight`
Label     | `--md-sys-typescale-label-medium-font`
&nbsp;    | `--md-sys-typescale-label-medium-size`
&nbsp;    | `--md-sys-typescale-label-medium-line-height`
&nbsp;    | `--md-sys-typescale-label-medium-weight`

*   [All tokens](https://github.com/material-components/material-web/blob/main/tokens/_md-sys-typescale.scss)
    <!-- {.external} -->

```css
:root {
  --md-sys-typescale-body-medium-size: 1rem;
  --md-sys-typescale-body-medium-line-height: 1.5rem;
  /* ... */
}
```

> Tip: prefer setting `--md-ref-typeface-brand` and `--md-ref-typeface-plain`
> over `--md-sys-typescale-<scale>-font` family tokens.

<!--#include file="../../googlers/theming-typography.md" -->
