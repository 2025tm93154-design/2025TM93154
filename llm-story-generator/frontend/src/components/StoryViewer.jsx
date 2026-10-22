function StoryViewer({ storyOutputs, characterOutput }) {
  return (
    <section className="story-viewer">
      <div className="story-section">
        <h2>Multi-Model Story</h2>
        {storyOutputs.length === 0 ? (
          <p className="empty-state">No story generated yet. Use the button above to create one.</p>
        ) : (
          storyOutputs.map((item) => (
            <article key={item.model} className="story-card">
              <h3>{item.model}</h3>
              <p>{item.output}</p>
            </article>
          ))
        )}
      </div>

      <div className="story-section">
        <h2>Character Continuation</h2>
        {characterOutput ? (
          <article className="story-card">
            <p>{characterOutput}</p>
          </article>
        ) : (
          <p className="empty-state">Create a character conversation to preserve tone across turns.</p>
        )}
      </div>
    </section>
  );
}

export default StoryViewer;
