# Batch Sets

Batch sets are GUI-managed lists of Suwol Atlas Maker project files.

## File Extension

```text
.suwol-atlas-batch.json
```

## Schema

```json
{
  "version": 1,
  "name": "Release QA",
  "projects": [
    "projects/atlas-a.suwol-atlas.json",
    "projects/atlas-b.suwol-atlas.json"
  ],
  "options": {
    "failFast": false
  },
  "schedule": {
    "enabled": false,
    "mode": "manual",
    "note": "Saved for future scheduling support."
  }
}
```

## Path Rules

When a batch set is saved, absolute project paths are written relative to the
batch set file when possible. When the batch set is run, relative project paths
are resolved from the batch set file's folder.

## GUI Flow

- Open Batch Set loads an existing `.suwol-atlas-batch.json`.
- Save Batch Set saves the current batch set to its known path, or asks for a
  path when the batch set is new.
- Save As writes a new batch set path.
- Add Project appends selected project files or folders without duplicating
  existing paths.
- Remove Project deletes one path from the current project list.
- Replace Projects fills the project list from a fresh project/folder selection.
- Run Now executes the current batch set immediately.
- The result list shows per-project success or failure after a manual run.

## Current Limits

Scheduling fields are saved, but there is no automatic scheduled runner yet.
The GUI displays the schedule control as disabled with a clear unsupported
message.
CLI batch set execution can be added later without changing the version 1 file
shape.
