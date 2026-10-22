import { useEffect, useState } from 'react';
import { saveStory, listStories, getStory, deleteStoryApi, downloadStory } from '../services/api';

function StoryManager({ currentOutputs = [], draftText = '', storyGenre = 'fantasy', selectedCharacterId, onLoadDraft, onRegenerateStory }) {
  const [stories, setStories] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState(draftText);
  const [genre, setGenre] = useState(storyGenre || 'fantasy');
  const [editingId, setEditingId] = useState('');

  const load = async () => {
    try {
      const res = await listStories();
      setStories(res.stories || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (currentOutputs?.length) {
      setContent(currentOutputs.map((o) => `--- ${o.model} ---\n${o.output}`).join('\n\n'));
    }
  }, [currentOutputs]);

  useEffect(() => {
    setDraft(draftText || '');
  }, [draftText]);

  useEffect(() => {
    setGenre(storyGenre || 'fantasy');
  }, [storyGenre]);

  const handleSave = async () => {
    try {
      const models = currentOutputs?.map((o) => o.model) || [];
      const id = editingId || undefined;
      await saveStory({ id, title: title || 'Untitled', content, models, character_id: selectedCharacterId, draft_text: draft, genre });
      setTitle('');
      setContent('');
      setEditingId('');
      load();
      alert('Draft saved and ready for reuse in later generation.');
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEdit = async (id) => {
    try {
      const res = await getStory(id);
      setEditingId(id);
      setTitle(res.story.title);
      setContent(res.story.content);
      setDraft(res.story.draft_text || '');
      setGenre(res.story.genre || 'fantasy');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete story?')) return;
    await deleteStoryApi(id);
    load();
  };

  const handleLoadDraft = (story) => {
    if (onLoadDraft) onLoadDraft(story.draft_text || '', story.id, story.genre || 'fantasy');
  };

  const handleRegenerate = async (story) => {
    handleLoadDraft(story);
    if (onRegenerateStory) {
      await onRegenerateStory(story.id);
    }
  };

  return (
    <section className="prompt-panel">
      <h3>Draft & Story Manager</h3>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Genre
        <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="fantasy, thriller, sci-fi" />
      </label>
      <label>
        Draft text
        <textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Edit or paste a saved draft here." />
      </label>
      <label>
        Content
        <textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Story output or edited content." />
      </label>
      <div className="button-row">
        <button onClick={handleSave}>Save Draft / Story</button>
      </div>

      <h4>Saved Stories</h4>
      <ul>
        {stories.map((s) => (
          <li key={s.id}>
            <strong>{s.title}</strong> — <small>{new Date(s.updated_at).toLocaleString()}</small>
            <div className="button-row">
              <button onClick={() => handleEdit(s.id)}>Edit</button>
              <button onClick={() => handleLoadDraft(s)}>Load Draft</button>
              <button onClick={() => handleRegenerate(s)}>Regenerate</button>
              <button onClick={() => downloadStory(s.id)}>Download</button>
              <button onClick={() => handleDelete(s.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default StoryManager;
