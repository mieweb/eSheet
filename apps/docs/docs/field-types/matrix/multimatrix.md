---
slug: /field-types/multimatrix
---

# multimatrix

Matrix with multiple selected columns per row.

## Properties

- `rows`: Array of `MatrixRow`
- `columns`: Array of `MatrixColumn`
- `scored` (optional): Enable automatic scoring by column index
- `scoreStart` (optional): Starting value for auto-scoring

## Answer Format

```json
{
  "selected": {
    "rowId": [{ "id": "columnId", "value": "Column Label" }]
  }
}
```

## Example

```json
{
  "id": "symptoms_time",
  "fieldType": "multimatrix",
  "question": "When do you experience symptoms?",
  "rows": [{ "id": "r_head", "value": "Headache" }],
  "columns": [
    { "id": "c_morn", "value": "Morning" },
    { "id": "c_night", "value": "Night" }
  ]
}
```
