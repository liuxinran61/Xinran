"""Text chunking service with overlap — heading-aware splitting."""

import re
from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.config import get_settings


class TextChunker:
    """Split documents into overlapping chunks for embedding and retrieval.

    Uses heading-aware splitting: the document is first split by markdown
    headings (##, ###) to preserve section boundaries, then long sections
    are sub-split with the character splitter.
    """

    # Pattern to match markdown headings at the start of a line
    HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)

    def __init__(self):
        settings = get_settings()
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", "；", ";", " ", ""],
            length_function=len,
        )

    def _split_by_headings(self, text: str) -> List[Dict]:
        """Split text into sections at heading boundaries.

        Each section includes its heading path (e.g. "## C-控制情绪").
        Returns list of {"heading_path": str, "content": str}.
        """
        sections: List[Dict] = []
        # Stack of (level, title) tuples — higher level = more #'s
        heading_stack: List[tuple[int, str]] = []

        prev_end = 0
        for match in self.HEADING_PATTERN.finditer(text):
            heading_start = match.start()
            # Capture text before this heading
            body = text[prev_end:heading_start].strip()
            if body:
                sections.append({
                    "heading_path": " > ".join(title for _, title in heading_stack) if heading_stack else "",
                    "content": body,
                })

            # Update heading stack
            level = len(match.group(1))  # number of #'s
            title = match.group(2).strip()

            # Pop all headings of the same or higher (deeper) level
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, title))

            prev_end = match.end()

        # Capture remaining text after last heading
        body = text[prev_end:].strip()
        if body:
            sections.append({
                "heading_path": " > ".join(title for _, title in heading_stack) if heading_stack else "",
                "content": body,
            })

        return sections

    def split(self, text: str) -> List[Dict]:
        """Split text into chunks with metadata including section context.

        Returns list of {content, chunk_index, metadata}
        """
        # Step 1: Split by headings first
        heading_sections = self._split_by_headings(text)

        # Step 2: Within each heading section, sub-split if too long.
        # Always prepend heading path to content for better vector retrieval.
        all_chunks: List[Dict] = []
        chunk_index = 0

        for section in heading_sections:
            section_text = section["content"]
            heading_path = section["heading_path"]

            if not section_text:
                continue

            # Build heading prefix (included in all chunks for this section)
            heading_prefix = f"[{heading_path}]\n" if heading_path else ""

            # If the section is short enough, keep it as one chunk
            if len(section_text) <= self.chunk_size:
                content = heading_prefix + section_text.strip() if heading_prefix else section_text.strip()
                all_chunks.append({
                    "content": content,
                    "chunk_index": chunk_index,
                    "metadata": {
                        "char_count": len(content),
                        "heading": heading_path,
                    },
                })
                chunk_index += 1
            else:
                # Sub-split long sections with heading prefix on every chunk
                sub_chunks = self.splitter.split_text(section_text)
                for sub in sub_chunks:
                    if sub.strip():
                        content = heading_prefix + sub.strip() if heading_prefix else sub.strip()
                        all_chunks.append({
                            "content": content,
                            "chunk_index": chunk_index,
                            "metadata": {
                                "char_count": len(content),
                                "heading": heading_path,
                            },
                        })
                        chunk_index += 1

        # Fallback: if heading split produced nothing, use plain splitter
        if not all_chunks:
            plain_chunks = self.splitter.split_text(text)
            for i, chunk in enumerate(plain_chunks):
                if chunk.strip():
                    all_chunks.append({
                        "content": chunk.strip(),
                        "chunk_index": i,
                        "metadata": {
                            "char_count": len(chunk),
                            "is_first": i == 0,
                            "is_last": i == len(plain_chunks) - 1,
                        },
                    })

        # Add first/last markers
        if all_chunks:
            all_chunks[0]["metadata"]["is_first"] = True
            all_chunks[-1]["metadata"]["is_last"] = True

        return all_chunks
