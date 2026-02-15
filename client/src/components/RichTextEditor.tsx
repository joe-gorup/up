import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  title,
}: {
  onClick: () => void;
  isActive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-600'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
      {editable && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            icon={UnderlineIcon}
            title="Underline"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            icon={Strikethrough}
            title="Strikethrough"
          />

          <div className="w-px bg-gray-300" />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            isActive={editor.isActive('heading', { level: 1 })}
            icon={Heading1}
            title="Heading 1"
          />
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            isActive={editor.isActive('heading', { level: 2 })}
            icon={Heading2}
            title="Heading 2"
          />

          <div className="w-px bg-gray-300" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={List}
            title="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={ListOrdered}
            title="Ordered List"
          />
        </div>
      )}

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 focus-within:outline-none"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}

interface RichTextViewerProps {
  content: string;
}

export function RichTextViewer({ content }: RichTextViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
    ],
    content,
    editable: false,
  });

  if (!editor) {
    return null;
  }

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm max-w-none"
    />
  );
}
