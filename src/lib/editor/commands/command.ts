import type { Document } from '../document';

export type CommandContext = Readonly<{
  document: Document;
}>;

export interface DocumentCommand {
  readonly id: string;
  readonly label: string;
  execute(context: CommandContext): Document;
  undo(context: CommandContext): Document;
  serialize(): Readonly<Record<string, unknown>>;
}
