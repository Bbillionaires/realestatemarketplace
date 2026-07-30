export class AdminNoteResponseDto {
  id!: string;
  conversationId!: string | null;
  authorName!: string;
  note!: string;
  createdAt!: Date;

  static from(note: {
    id: string;
    conversationId: string | null;
    author: { profile?: { displayName: string } | null; email: string };
    note: string;
    createdAt: Date;
  }): AdminNoteResponseDto {
    const dto = new AdminNoteResponseDto();
    dto.id = note.id;
    dto.conversationId = note.conversationId;
    dto.authorName = note.author.profile?.displayName ?? note.author.email;
    dto.note = note.note;
    dto.createdAt = note.createdAt;
    return dto;
  }
}
