---
slug: /field-types/singlematrix
---

# singlematrix

Matrix with one selected column per row.

## Properties

- `rows`: Array of `MatrixRow`
- `columns`: Array of `MatrixColumn`
- `scored` (optional): Enable automatic scoring by column index
- `scoreStart` (optional): Starting value for auto-scoring

## Answer Format

```json
{
  "selected": {
    "rowId": { "id": "columnId", "value": "Column Label" }
  }
}
```

## Example

```json
{
  "id": "symptom_severity",
  "fieldType": "singlematrix",
  "question": "Rate symptom severity",
  "rows": [{ "id": "r_head", "value": "Headache" }],
  "columns": [
    { "id": "c_none", "value": "None" },
    { "id": "c_mild", "value": "Mild" }
  ]
}
```