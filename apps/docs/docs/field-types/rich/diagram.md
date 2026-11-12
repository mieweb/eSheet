---
slug: /field-types/diagram
---

# diagram

Markup and annotation drawing pad.

When image attachments are allowed, use the floating **Attach file** upload icon
beside Undo, Redo, and Clear in the upper-right corner of the drawing canvas.
Attached images show their filename in the same bar, with an **X** button to
remove the image and its strokes and restore the authored background. Long names
are truncated; hover to see the full name.

## Properties

- `padPlaceholder`: Placeholder text for the drawing area
- `allowImageAttachments`: Allow respondents to upload an image or choose one from
  a host-supplied document picker (default: `true`). Set this in the builder's
  inline editor or Edit panel using **Allow image attachments in renderer**.
  Setting it to `false` hides both options and blocks attachment handlers and
  pending loads without removing saved images or restricting authored backgrounds.

## Answer Format

```yaml
markupData: serialized-strokes
markupImage: base64-png
markupBackground: attached-image-data-url
markupBackgroundTitle: original-filename.png
```

`markupBackground` and `markupBackgroundTitle` are present for respondent-attached
images. Older saved images without a filename display “Attached image”.

## Example

```yaml
id: pain_diagram
fieldType: diagram
question: Mark the areas where you feel pain
padPlaceholder: Draw on the diagram
```
