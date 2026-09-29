import type { ImageCommand, ImageDocument } from "./types";

export class ImageHistory {
  private readonly undoStack: ImageCommand[] = [];
  private readonly redoStack: ImageCommand[] = [];

  execute(document: ImageDocument, command: ImageCommand): ImageDocument {
    const next = command.execute(document);
    this.undoStack.push(command);
    this.redoStack.length = 0;
    return next;
  }

  undo(document: ImageDocument): ImageDocument {
    const command = this.undoStack.pop();
    if (!command) return document;
    const previous = command.undo(document);
    this.redoStack.push(command);
    return previous;
  }

  redo(document: ImageDocument): ImageDocument {
    const command = this.redoStack.pop();
    if (!command) return document;
    const next = command.execute(document);
    this.undoStack.push(command);
    return next;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get size(): number { return this.undoStack.length; }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
